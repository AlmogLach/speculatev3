// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PositionToken.sol";
import "./interfaces/AggregatorV3Interface.sol";

contract SpeculateCore is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public treasury;
    address public chainlinkResolver;

    bytes32 public constant MARKET_CREATOR_ROLE = keccak256("MARKET_CREATOR_ROLE");
    uint256 public constant USDC_TO_E18 = 1e12;
    uint256 public constant MAX_USDC_PER_TRADE = 100_000e6;
    uint256 public liquidityMultiplierE18 = 1e18; // 1x → matches your sims

    enum MarketStatus { Active, Resolved }
    enum OracleType { None, ChainlinkFeed }
    enum Comparison { Above, Below, Equals }

    struct ResolutionConfig {
        uint256 expiryTimestamp;
        OracleType oracleType;
        address oracleAddress;
        bytes32 priceFeedId;
        uint256 targetValue;
        Comparison comparison;
        bool yesWins;
        bool isResolved;
    }

    struct Market {
        PositionToken yes;
        PositionToken no;
        uint256 qYes;
        uint256 qNo;
        uint256 usdcVault;
        uint256 totalPairsUSDC;
        uint256 bE18;
        uint16 feeTreasuryBps;   // 100 = 1.00%
        uint16 feeVaultBps;      // 50  = 0.50%
        uint16 feeLpBps;         // 50  = 0.50%
        MarketStatus status;
        string question;
        address lp;
        ResolutionConfig resolution;
    }

    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    // === MATH CONSTANTS ===
    uint256 private constant SCALE = 1e18;
    uint256 private constant LN2 = 693_147_180_559_945_309;
    uint256 private constant LOG2_E = 1_442_695_040_888_963_407;
    uint256 private constant TWO_OVER_LN2 = 2 * SCALE * SCALE / LN2;

    // === EVENTS ===
    event MarketCreated(uint256 id, address yes, address no, string question, uint256 initUsdc);
    event Buy(uint256 id, address user, bool isYes, uint256 usdcIn, uint256 tokensOut, uint256 priceE6);
    event Sell(uint256 id, address user, bool isYes, uint256 tokensIn, uint256 usdcOut, uint256 priceE6);
    event Redeemed(uint256 id, address user, uint256 usdcOut);
    event MarketResolved(uint256 id, bool yesWins);

    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0) && _treasury != address(0), "zero addr");
        usdc = IERC20(_usdc);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MARKET_CREATOR_ROLE, msg.sender);
    }

    // === MATH ===
    function mul(uint256 x, uint256 y) internal pure returns (uint256) { return x * y / SCALE; }
    function div(uint256 x, uint256 y) internal pure returns (uint256) { return x * SCALE / y; }

    function exp2(uint256 x) internal pure returns (uint256) {
        if (x > 192 * SCALE) revert("exp2 overflow");
        uint256 intPart = x / SCALE;
        uint256 frac = x % SCALE;
        uint256 res = SCALE;
        uint256 term = SCALE;
        uint256 y = mul(frac, LN2);
        for (uint8 i = 1; i <= 20;) {
            term = mul(term, y) / i;
            res += term;
            unchecked { ++i; }
        }
        return (1 << intPart) * res;
    }

    function ln(uint256 x) internal pure returns (uint256) {
        if (x == 0) revert("ln0");
        return mul(log2(x), LN2);
    }

    function log2(uint256 x) internal pure returns (uint256) {
        uint256 res = 0;
        if (x >= SCALE << 128) { x >>= 128; res += 128 * SCALE; }
        if (x >= SCALE << 64)  { x >>= 64;  res += 64 * SCALE; }
        if (x >= SCALE << 32)  { x >>= 32;  res += 32 * SCALE; }
        if (x >= SCALE << 16)  { x >>= 16;  res += 16 * SCALE; }
        if (x >= SCALE << 8)   { x >>= 8;   res += 8 * SCALE; }
        if (x >= SCALE << 4)   { x >>= 4;   res += 4 * SCALE; }
        if (x >= SCALE << 2)   { x >>= 2;   res += 2 * SCALE; }
        if (x >= SCALE << 1)   { res += SCALE; x >>= 1; }
        uint256 z = div(x - SCALE, x + SCALE);
        uint256 z2 = mul(z, z);
        uint256 w = SCALE;
        w += mul(z2, SCALE) / 3;
        uint256 z4 = mul(z2, z2);
        w += mul(z4, SCALE) / 5;
        uint256 z6 = mul(z4, z2);
        w += mul(z6, SCALE) / 7;
        uint256 z8 = mul(z6, z2);
        w += mul(z8, SCALE) / 9;
        return res + mul(mul(z, w), TWO_OVER_LN2);
    }

    function _C(uint256 qY, uint256 qN, uint256 b) internal pure returns (uint256) {
        uint256 eY = exp2(mul(div(qY, b), LOG2_E));
        uint256 eN = exp2(mul(div(qN, b), LOG2_E));
        return mul(b, ln(eY + eN));
    }

    function spotPriceYesE18(uint256 id) public view returns (uint256) {
        Market storage m = markets[id];
        uint256 eY = exp2(mul(div(m.qYes, m.bE18), LOG2_E));
        uint256 eN = exp2(mul(div(m.qNo, m.bE18), LOG2_E));
        return div(eY, eY + eN);
    }

    // === MARKET CREATION ===
    function createMarket(
        string memory question,
        string memory yesName, string memory yesSymbol,
        string memory noName, string memory noSymbol,
        uint256 initUsdc,
        uint256 expiryTimestamp,
        address oracle,
        uint256 targetValue,
        Comparison comparison
    ) external onlyRole(MARKET_CREATOR_ROLE) returns (uint256 id) {
        require(initUsdc >= 100e6, "seed too small");
        id = ++marketCount;

        PositionToken yes = new PositionToken(yesName, yesSymbol, address(this));
        PositionToken no = new PositionToken(noName, noSymbol, address(this));
        yes.grantRole(yes.MINTER_ROLE(), address(this));
        yes.grantRole(yes.BURNER_ROLE(), address(this));
        no.grantRole(no.MINTER_ROLE(), address(this));
        no.grantRole(no.BURNER_ROLE(), address(this));

        Market storage m = markets[id];
        m.yes = yes; m.no = no;
        m.lp = msg.sender;
        m.question = question;
        m.status = MarketStatus.Active;

        // 2% total → 1% treasury, 0.5% vault, 0.5% LP
        m.feeTreasuryBps = 100;
        m.feeVaultBps = 50;
        m.feeLpBps = 50;

        usdc.safeTransferFrom(msg.sender, address(this), initUsdc);
        m.usdcVault = initUsdc;
        m.totalPairsUSDC = initUsdc;

        // b = vault / ln(2) → matches your Excel
        m.bE18 = (initUsdc * liquidityMultiplierE18 * USDC_TO_E18) / LN2;

        m.resolution = ResolutionConfig({
            expiryTimestamp: expiryTimestamp,
            oracleType: OracleType.ChainlinkFeed,
            oracleAddress: oracle,
            priceFeedId: bytes32(0),
            targetValue: targetValue,
            comparison: comparison,
            yesWins: false,
            isResolved: false
        });

        emit MarketCreated(id, address(yes), address(no), question, initUsdc);
    }

    // === BINARY SEARCH FOR SHARES OUT ===
    function findSharesOut(uint256 qSide, uint256 qOther, uint256 netE18, uint256 b) internal pure returns (uint256) {
        uint256 lo = 0;
        uint256 hi = b * 100; // safe upper bound
        uint256 baseCost = _C(qSide, qOther, b);
        for (uint256 i = 0; i < 60;) {
            uint256 mid = (lo + hi) / 2;
            if (_C(qSide + mid, qOther, b) - baseCost <= netE18) {
                lo = mid;
            } else {
                hi = mid;
            }
            unchecked { ++i; }
        }
        return (lo + hi) / 2;
    }

    // === TRADING ===
    function _buy(uint256 id, bool isYes, uint256 usdcIn) internal returns (uint256 tokensOut, uint256 avgPriceE6) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Active, "not active");
        require(block.timestamp < m.resolution.expiryTimestamp, "expired");
        require(usdcIn <= MAX_USDC_PER_TRADE, "too big");

        uint256 feeT = usdcIn * m.feeTreasuryBps / 10_000;
        uint256 feeV = usdcIn * m.feeVaultBps / 10_000;
        uint256 feeL = usdcIn * m.feeLpBps / 10_000;
        uint256 net = usdcIn - feeT - feeV - feeL;

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);
        if (feeT > 0) usdc.safeTransfer(treasury, feeT);
        if (feeL > 0) usdc.safeTransfer(m.lp, feeL);

        m.usdcVault += net + feeV;
        m.totalPairsUSDC += net + feeV;

        uint256 netE18 = net * USDC_TO_E18;
        tokensOut = findSharesOut(
            isYes ? m.qYes : m.qNo,
            isYes ? m.qNo : m.qYes,
            netE18,
            m.bE18
        );
        require(tokensOut > 100, "dust");

        if (isYes) {
            m.yes.mint(msg.sender, tokensOut);
            m.qYes += tokensOut;
        } else {
            m.no.mint(msg.sender, tokensOut);
            m.qNo += tokensOut;
        }

        avgPriceE6 = (usdcIn * 1e12) / tokensOut;
        emit Buy(id, msg.sender, isYes, usdcIn, tokensOut, avgPriceE6);
    }

    function _sell(uint256 id, bool isYes, uint256 tokensIn) internal returns (uint256 usdcOut, uint256 avgPriceE6) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Active, "not active");
        require(tokensIn > 100, "dust");

        uint256 qSide = isYes ? m.qYes : m.qNo;
        require(tokensIn <= qSide, "not enough");

        uint256 oldC = _C(m.qYes, m.qNo, m.bE18);
        uint256 newC = _C(
            isYes ? m.qYes - tokensIn : m.qYes,
            isYes ? m.qNo : m.qNo - tokensIn,
            m.bE18
        );
        uint256 refundE18 = oldC - newC;
        usdcOut = refundE18 / USDC_TO_E18;

        require(usdcOut <= m.usdcVault, "insolvent");
        m.usdcVault -= usdcOut;
        m.totalPairsUSDC -= usdcOut;

        if (isYes) {
            m.yes.burn(msg.sender, tokensIn);
            m.qYes -= tokensIn;
        } else {
            m.no.burn(msg.sender, tokensIn);
            m.qNo -= tokensIn;
        }

        usdc.safeTransfer(msg.sender, usdcOut);
        avgPriceE6 = (usdcOut * 1e12) / tokensIn;
        emit Sell(id, msg.sender, isYes, tokensIn, usdcOut, avgPriceE6);
    }

    // === PUBLIC ENTRYPOINTS ===
    function buyYes(uint256 id, uint256 usdcIn, uint256 minOut) external nonReentrant {
        (uint256 out, uint256 p) = _buy(id, true, usdcIn);
        require(out >= minOut, "slippage");
    }
    function buyNo(uint256 id, uint256 usdcIn, uint256 minOut) external nonReentrant {
        (uint256 out, uint256 p) = _buy(id, false, usdcIn);
        require(out >= minOut, "slippage");
    }
    function sellYes(uint256 id, uint256 tokensIn, uint256 minOut) external nonReentrant {
        (uint256 out, uint256 p) = _sell(id, true, tokensIn);
        require(out >= minOut, "slippage");
    }
    function sellNo(uint256 id, uint256 tokensIn, uint256 minOut) external nonReentrant {
        (uint256 out, uint256 p) = _sell(id, false, tokensIn);
        require(out >= minOut, "slippage");
    }

    function checkUpkeep(uint256 id) external view returns (bool, bytes memory) {
        Market storage m = markets[id];
        bool need = m.status == MarketStatus.Active
            && !m.resolution.isResolved
            && block.timestamp >= m.resolution.expiryTimestamp
            && m.resolution.oracleType != OracleType.None;
        return (need, abi.encode(id));
    }

    function getMarketResolution(uint256 id) external view returns (ResolutionConfig memory) {
        return markets[id].resolution;
    }

    // === RESOLUTION ===
    function resolveWithFeed(uint256 id) external {
        Market storage m = markets[id];
        require(!m.resolution.isResolved, "already resolved");
        require(block.timestamp >= m.resolution.expiryTimestamp, "not expired");

        ( , int256 price, , uint256 updatedAt, ) = AggregatorV3Interface(m.resolution.oracleAddress).latestRoundData();
        require(block.timestamp - updatedAt < 3600, "stale oracle");

        bool yesWins = price > int256(m.resolution.targetValue)
            ? m.resolution.comparison == Comparison.Above
            : price < int256(m.resolution.targetValue)
                ? m.resolution.comparison == Comparison.Below
                : m.resolution.comparison == Comparison.Equals;

        m.resolution.yesWins = yesWins;
        m.resolution.isResolved = true;
        m.status = MarketStatus.Resolved;
        emit MarketResolved(id, yesWins);
    }

    function resolveMarketWithPrice(uint256 id, uint256 price) external {
        require(msg.sender == chainlinkResolver || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "unauthorized");
        Market storage m = markets[id];
        require(m.status == MarketStatus.Active && !m.resolution.isResolved, "resolved");
        require(block.timestamp >= m.resolution.expiryTimestamp, "not expired");

        bool yesWins = price > m.resolution.targetValue
            ? m.resolution.comparison == Comparison.Above
            : price < m.resolution.targetValue
                ? m.resolution.comparison == Comparison.Below
                : m.resolution.comparison == Comparison.Equals;

        m.resolution.yesWins = yesWins;
        m.resolution.isResolved = true;
        m.status = MarketStatus.Resolved;
        emit MarketResolved(id, yesWins);
    }

    function resolveMarket(uint256 id, bool yesWins) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Active && !m.resolution.isResolved, "resolved");
        m.resolution.yesWins = yesWins;
        m.resolution.isResolved = true;
        m.status = MarketStatus.Resolved;
        emit MarketResolved(id, yesWins);
    }

    // === REDEEM: $1 PER WINNING TOKEN ===
    function redeem(uint256 id, bool isYes) external nonReentrant {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Resolved && m.resolution.isResolved, "not resolved");
        require(isYes == m.resolution.yesWins, "loser");

        uint256 balance = isYes ? m.yes.balanceOf(msg.sender) : m.no.balanceOf(msg.sender);
        require(balance > 0, "nothing");

        uint256 totalWinning = isYes ? m.yes.totalSupply() : m.no.totalSupply();
        uint256 usdcOut = balance * m.usdcVault / totalWinning;

        if (isYes) m.yes.burn(msg.sender, balance);
        else m.no.burn(msg.sender, balance);

        m.usdcVault -= usdcOut;
        usdc.safeTransfer(msg.sender, usdcOut);
        emit Redeemed(id, msg.sender, usdcOut);
    }

    // === ADMIN ===
    function setTreasury(address a) external onlyRole(DEFAULT_ADMIN_ROLE) { treasury = a; }
    function setChainlinkResolver(address a) external onlyRole(DEFAULT_ADMIN_ROLE) { chainlinkResolver = a; }
    function setLiquidityMultiplier(uint256 x) external onlyRole(DEFAULT_ADMIN_ROLE) { liquidityMultiplierE18 = x; }
    function setPriceFeedId(uint256 id, bytes32 feedId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        markets[id].resolution.priceFeedId = feedId;
    }
}