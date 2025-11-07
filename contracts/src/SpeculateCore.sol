// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./PositionToken.sol";
import "./interfaces/AggregatorV3Interface.sol";

/**
 * @title SpeculateCore
 * @notice Constant Product AMM for binary prediction markets with Chainlink integration
 *         BUY logic adds symmetric YES+NO liquidity with user's USDC, then swaps internally.
 *         50 USDC at 0.5 gives ~98 YES instead of ~49.
 */
contract SpeculateCore is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant MARKET_CREATOR_ROLE = keccak256("MARKET_CREATOR_ROLE");

    uint256 private constant USDC_TO_E18 = 1e12; // 6 -> 18 decimals
    uint256 public constant MAX_USDC_PER_TRADE = 100_000e6; // soft limit per trade

    enum MarketStatus { Active, Paused, Resolved }
    enum OracleType { None, ChainlinkFeed, ChainlinkFunctions }
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
        uint256 reserveYes;   // 18 decimals
        uint256 reserveNo;    // 18 decimals
        uint256 usdcVault;    // 6 decimals
        uint256 totalPairsUSDC; // 6 decimals, tracks total paired USDC
        uint256 virtualOffsetE18; // cumulative symmetric boost applied to both sides
        uint16 feeTreasuryBps;
        uint16 feeVaultBps;
        uint16 feeLpBps;
        uint16 maxTradeBps;
        MarketStatus status;
        bool exists;
        bool sellFees;
        string question;
        address lp;
        ResolutionConfig resolution;
    }

    IERC20 public immutable usdc;
    address public treasury;
    mapping(uint256 => Market) public markets;
    uint256 public marketCount;
    address public chainlinkResolver;

    event MarketCreated(
        uint256 indexed id,
        address yes,
        address no,
        string question,
        uint256 reserveYes,
        uint256 reserveNo,
        uint256 usdcVault,
        uint256 expiryTimestamp,
        OracleType oracleType
    );
    event MarketResolved(uint256 indexed id, bool yesWins, uint256 resolvedPrice);
    event Redeemed(uint256 indexed id, address indexed user, bool isYes, uint256 tokensIn, uint256 usdcOut);
    event BuyYes(uint256 indexed id, address indexed user, uint256 usdcIn, uint256 tokensOut, uint256 priceE6);
    event BuyNo(uint256 indexed id, address indexed user, uint256 usdcIn, uint256 tokensOut, uint256 priceE6);
    event SellYes(uint256 indexed id, address indexed user, uint256 tokensIn, uint256 usdcOut, uint256 priceE6);
    event SellNo(uint256 indexed id, address indexed user, uint256 tokensIn, uint256 usdcOut, uint256 priceE6);
    event FeeCollected(
        uint256 indexed id,
        address indexed trader,
        uint256 feeTreasury,
        uint256 feeVault,
        uint256 feeLp,
        bool isBuy
    );

    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0) && _treasury != address(0), "invalid params");
        usdc = IERC20(_usdc);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MARKET_CREATOR_ROLE, msg.sender);
    }

    // ------------------------------------------------------------
    // Admin
    // ------------------------------------------------------------
    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "zero");
        treasury = _treasury;
    }

    function setChainlinkResolver(address _resolver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        chainlinkResolver = _resolver;
    }

    function setAllFees(uint256 id, uint16 t, uint16 v, uint16 l, bool _sellFees) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].exists, "not found");
        require(t + v + l <= 1000, "too high");
        markets[id].feeTreasuryBps = t;
        markets[id].feeVaultBps = v;
        markets[id].feeLpBps = l;
        markets[id].sellFees = _sellFees;
    }

    function grantMarketCreator(address a) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MARKET_CREATOR_ROLE, a);
    }

    // ------------------------------------------------------------
    // Market creation
    // ------------------------------------------------------------
    function createMarket(
        string memory question,
        string memory yesName,
        string memory yesSymbol,
        string memory noName,
        string memory noSymbol,
        uint256 initReserveE18,
        uint16 feeBps,
        uint16 maxTradeBps,
        uint256 initUsdc,
        uint256 expiryTimestamp,
        OracleType oracleType,
        address oracleAddress,
        bytes32 priceFeedId,
        uint256 targetValue,
        Comparison comparison
    ) external onlyRole(MARKET_CREATOR_ROLE) returns (uint256 id) {
        require(initUsdc >= 1e6 && initReserveE18 >= 1e18, "too low");
        require(feeBps <= 1000, "fee too high");
        require(maxTradeBps > 0 && maxTradeBps <= 10000, "invalid trade");

        id = ++marketCount;

        PositionToken yes = new PositionToken(yesName, yesSymbol, address(this));
        PositionToken no = new PositionToken(noName, noSymbol, address(this));

        yes.grantRole(yes.MINTER_ROLE(), address(this));
        yes.grantRole(yes.BURNER_ROLE(), address(this));
        no.grantRole(no.MINTER_ROLE(), address(this));
        no.grantRole(no.BURNER_ROLE(), address(this));

        Market storage m = markets[id];
        m.yes = yes;
        m.no = no;
        m.reserveYes = initReserveE18;
        m.reserveNo = initReserveE18;

        uint16 treasuryCut = uint16((uint256(feeBps) * 50) / 100);
        uint16 vaultCut = uint16((uint256(feeBps) * 25) / 100);
        uint16 lpCut = uint16(feeBps - treasuryCut - vaultCut);
        m.feeTreasuryBps = treasuryCut;
        m.feeVaultBps = vaultCut;
        m.feeLpBps = lpCut;
        m.maxTradeBps = maxTradeBps;
        m.status = MarketStatus.Active;
        m.exists = true;
        m.lp = msg.sender;
        m.question = question;

        m.resolution = ResolutionConfig({
            expiryTimestamp: expiryTimestamp,
            oracleType: oracleType,
            oracleAddress: oracleAddress,
            priceFeedId: priceFeedId,
            targetValue: targetValue,
            comparison: comparison,
            yesWins: false,
            isResolved: false
        });

        // pull USDC in
        usdc.safeTransferFrom(msg.sender, address(this), initUsdc);
        m.usdcVault = initUsdc;
        m.totalPairsUSDC = initUsdc;

        // mint initial YES/NO to contract
        yes.mint(address(this), initReserveE18);
        no.mint(address(this), initReserveE18);

        emit MarketCreated(
            id,
            address(yes),
            address(no),
            question,
            initReserveE18,
            initReserveE18,
            initUsdc,
            expiryTimestamp,
            oracleType
        );
    }

    // ------------------------------------------------------------
    // Math helpers
    // ------------------------------------------------------------
    function sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }

    // ------------------------------------------------------------
    // Pricing helpers
    // ------------------------------------------------------------
    function spotPriceYesE6(uint256 id) public view returns (uint256) {
        Market storage m = markets[id];
        require(m.exists, "not found");
        uint256 boostedYes = m.reserveYes + m.virtualOffsetE18;
        uint256 boostedNo = m.reserveNo + m.virtualOffsetE18;
        uint256 denom = boostedYes + boostedNo;
        if (denom == 0) return 0;
        return (boostedNo * 1e6) / denom;
    }

    function spotPriceNoE6(uint256 id) public view returns (uint256) {
        Market storage m = markets[id];
        require(m.exists, "not found");
        uint256 boostedYes = m.reserveYes + m.virtualOffsetE18;
        uint256 boostedNo = m.reserveNo + m.virtualOffsetE18;
        uint256 denom = boostedYes + boostedNo;
        if (denom == 0) return 0;
        return (boostedYes * 1e6) / denom;
    }

    // ------------------------------------------------------------
    // AMM core
    // ------------------------------------------------------------
    /**
     * BUY (boosted):
     * 1. take USDC, charge fees
     * 2. convert to amountE18
     * 3. add amountE18 to BOTH reserves
     * 4. swap amountE18 of the opposite side
     * 5. user = amountE18 + swapOut
     */
    function _buy(uint256 id, bool isYes, uint256 usdcIn)
        internal
        returns (uint256 tokensOut, uint256 priceE6)
    {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Active, "not active");
        require(usdcIn > 0 && usdcIn <= MAX_USDC_PER_TRADE, "invalid size");

        // pull USDC
        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        // fees
        uint256 feeT = (usdcIn * m.feeTreasuryBps) / 10000;
        uint256 feeV = (usdcIn * m.feeVaultBps) / 10000;
        uint256 feeL = (usdcIn * m.feeLpBps) / 10000;
        uint256 netUsdc = usdcIn - (feeT + feeV + feeL);

        if (feeT > 0) usdc.safeTransfer(treasury, feeT);
        if (feeL > 0 && m.lp != address(0)) usdc.safeTransfer(m.lp, feeL);
        // feeV stays in contract (m.usdcVault)

        // convert to 18 decimals
        uint256 amountE18 = netUsdc * USDC_TO_E18;
        require(amountE18 > 0, "zero amount");

        uint256 virtualBefore = m.virtualOffsetE18;
        uint256 boostedYesBefore = m.reserveYes + virtualBefore;
        uint256 boostedNoBefore = m.reserveNo + virtualBefore;

        // add symmetric liquidity (virtual + real)
        uint256 x = boostedYesBefore + amountE18;
        uint256 y = boostedNoBefore + amountE18;
        uint256 k = x * y;
        uint256 virtualAfter = virtualBefore + amountE18;

        if (isYes) {
            // swap NO -> YES with amountE18 against boosted reserves
            uint256 denominator = y + amountE18;
            require(denominator > 0, "denom");
            uint256 newBoostedYes = k / denominator;
            uint256 yesFromSwap = x - newBoostedYes;
            tokensOut = amountE18 + yesFromSwap;

            uint256 newBoostedNo = y + amountE18;
            require(newBoostedYes >= virtualAfter, "underflow yes");
            require(newBoostedNo >= virtualAfter, "underflow no");

            m.reserveYes = newBoostedYes - virtualAfter;
            m.reserveNo = newBoostedNo - virtualAfter;
            m.virtualOffsetE18 = virtualAfter;
            m.yes.mint(msg.sender, tokensOut);
        } else {
            // swap YES -> NO with amountE18 against boosted reserves
            uint256 denominator = x + amountE18;
            require(denominator > 0, "denom");
            uint256 newBoostedNo = k / denominator;
            uint256 noFromSwap = y - newBoostedNo;
            tokensOut = amountE18 + noFromSwap;

            uint256 newBoostedYes = x + amountE18;
            require(newBoostedYes >= virtualAfter, "underflow yes");
            require(newBoostedNo >= virtualAfter, "underflow no");

            m.reserveNo = newBoostedNo - virtualAfter;
            m.reserveYes = newBoostedYes - virtualAfter;
            m.virtualOffsetE18 = virtualAfter;
            m.no.mint(msg.sender, tokensOut);
        }

        // FIX: only add the amount that stays in the contract
        uint256 addedToVault = usdcIn - feeT - feeL;
        m.usdcVault += addedToVault;
        m.totalPairsUSDC += addedToVault;

        priceE6 = spotPriceYesE6(id);
        emit FeeCollected(id, msg.sender, feeT, feeV, feeL, true);
    }

    /**
     * SELL (true curve mirror of _buy)
     * Uses quadratic formula to solve for the symmetric liquidity unwound
     * A = (S - sqrt(S^2 - 4 t Opp)) / 2
     */
    function _sell(uint256 id, bool isYes, uint256 tokensIn)
        internal
        returns (uint256 usdcOut, uint256 priceE6)
    {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Active, "not active");
        require(tokensIn > 0, "zero");

        // pull & burn
        if (isYes) {
            IERC20(address(m.yes)).safeTransferFrom(msg.sender, address(this), tokensIn);
            m.yes.burn(address(this), tokensIn);
        } else {
            IERC20(address(m.no)).safeTransferFrom(msg.sender, address(this), tokensIn);
            m.no.burn(address(this), tokensIn);
        }

        uint256 v = m.virtualOffsetE18;
        uint256 by = m.reserveYes + v;
        uint256 bn = m.reserveNo + v;

        // choose which side we are selling
        uint256 boostedSame     = isYes ? by : bn;
        uint256 boostedOpposite = isYes ? bn : by;
        uint256 t = tokensIn;

        // quadratic: A = (S - sqrt(S^2 - 4 t Opp)) / 2
        // S = boostedSame + boostedOpposite + t
        uint256 S = boostedSame + boostedOpposite + t;

        // to avoid overflow: compute S^2 as 512-bit style? we'll just rely on realistic pool sizes
        // but add a guard:
        require(S <= type(uint128).max, "too big"); // optional safety

        uint256 S2 = S * S;
        uint256 fourTOpp = 4 * t * boostedOpposite;
        require(S2 > fourTOpp, "invalid disc");

        uint256 disc = S2 - fourTOpp;
        uint256 sqrtDisc = sqrt(disc);
        require(S >= sqrtDisc, "invalid sqrt");

        uint256 a = (S - sqrtDisc) / 2;
        require(a > 0, "zero a");
        // we are going to reduce virtualOffset by a
        require(a <= v, "too large");

        // we also subtract 2a from the opposite boosted reserve
        require(boostedOpposite >= 2 * a, "underflow opp");
        uint256 boostedOppositeBefore = boostedOpposite - 2 * a;

        // reconstruct the other one:
        // boostedSameBefore + a and boostedOppositeBefore + a should still satisfy CPMM:
        // (boostedSameBefore + a) * (boostedOppositeBefore + a) = boostedSame * boostedOpposite
        //
        // => boostedSameBefore = (boostedSame * boostedOpposite) / (boostedOppositeBefore + a) - a
        uint256 denom = boostedOppositeBefore + a;
        require(denom > 0, "denom");
        uint256 boostedSameBefore = (boostedSame * boostedOpposite) / denom - a;

        uint256 newV = v - a;
        require(boostedSameBefore >= newV, "underflow same");
        require(boostedOppositeBefore >= newV, "underflow opp2");

        if (isYes) {
            m.reserveYes = boostedSameBefore - newV;
            m.reserveNo  = boostedOppositeBefore - newV;
        } else {
            m.reserveYes = boostedOppositeBefore - newV;
            m.reserveNo  = boostedSameBefore - newV;
        }
        m.virtualOffsetE18 = newV;

        // payout is exactly the "symmetric liquidity" we unwound
        usdcOut = a / USDC_TO_E18;
        require(usdcOut > 0, "zero out");
        require(usdcOut <= m.usdcVault, "vault");

        if (m.sellFees) {
            uint256 feeT = (usdcOut * m.feeTreasuryBps) / 10000;
            uint256 feeV = (usdcOut * m.feeVaultBps) / 10000;
            uint256 feeL = (usdcOut * m.feeLpBps) / 10000;
            uint256 payout = usdcOut - (feeT + feeV + feeL);

            m.usdcVault -= (payout + feeT + feeL);
            m.totalPairsUSDC -= (payout + feeT + feeL);

            if (feeT > 0) usdc.safeTransfer(treasury, feeT);
            if (feeL > 0 && m.lp != address(0)) usdc.safeTransfer(m.lp, feeL);
            usdc.safeTransfer(msg.sender, payout);

            emit FeeCollected(id, msg.sender, feeT, feeV, feeL, false);
        } else {
            m.usdcVault -= usdcOut;
            m.totalPairsUSDC -= usdcOut;
            usdc.safeTransfer(msg.sender, usdcOut);
        }

        priceE6 = spotPriceYesE6(id);
    }

    // ------------------------------------------------------------
    // Public trade functions
    // ------------------------------------------------------------
    function buyYes(uint256 id, uint256 usdcIn, uint256 minOut) external nonReentrant {
        (uint256 out, uint256 p) = _buy(id, true, usdcIn);
        require(out >= minOut, "slippage");
        emit BuyYes(id, msg.sender, usdcIn, out, p);
    }

    function buyNo(uint256 id, uint256 usdcIn, uint256 minOut) external nonReentrant {
        (uint256 out, uint256 p) = _buy(id, false, usdcIn);
        require(out >= minOut, "slippage");
        emit BuyNo(id, msg.sender, usdcIn, out, p);
    }

    function sellYes(uint256 id, uint256 tokensIn, uint256 minUsdcOut) external nonReentrant {
        (uint256 out, uint256 p) = _sell(id, true, tokensIn);
        require(out >= minUsdcOut, "slippage");
        emit SellYes(id, msg.sender, tokensIn, out, p);
    }

    function sellNo(uint256 id, uint256 tokensIn, uint256 minUsdcOut) external nonReentrant {
        (uint256 out, uint256 p) = _sell(id, false, tokensIn);
        require(out >= minUsdcOut, "slippage");
        emit SellNo(id, msg.sender, tokensIn, out, p);
    }

    // ------------------------------------------------------------
    // Oracle & resolution
    // ------------------------------------------------------------
    function resolveMarket(uint256 id, bool yesWins) external onlyRole(DEFAULT_ADMIN_ROLE) {
        Market storage m = markets[id];
        require(m.exists && !m.resolution.isResolved, "resolved");
        m.status = MarketStatus.Resolved;
        m.resolution.yesWins = yesWins;
        m.resolution.isResolved = true;
        emit MarketResolved(id, yesWins, 0);
    }

    function autoResolveMarket(uint256 id) external {
        Market storage m = markets[id];
        require(m.exists && !m.resolution.isResolved, "resolved");
        require(block.timestamp >= m.resolution.expiryTimestamp, "not expired");
        require(m.resolution.oracleType != OracleType.None, "manual");
        require(msg.sender == chainlinkResolver || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "unauth");

        uint256 price = _fetchOraclePrice(m.resolution);
        bool yesWins = _comparePrice(price, m.resolution.targetValue, m.resolution.comparison);
        m.status = MarketStatus.Resolved;
        m.resolution.yesWins = yesWins;
        m.resolution.isResolved = true;
        emit MarketResolved(id, yesWins, price);
    }

    function resolveMarketWithPrice(uint256 id, uint256 price) external {
        Market storage m = markets[id];
        require(m.exists && !m.resolution.isResolved, "resolved");
        require(block.timestamp >= m.resolution.expiryTimestamp, "not expired");
        require(msg.sender == chainlinkResolver || hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "unauth");

        bool yesWins = _comparePrice(price, m.resolution.targetValue, m.resolution.comparison);
        m.status = MarketStatus.Resolved;
        m.resolution.yesWins = yesWins;
        m.resolution.isResolved = true;
        emit MarketResolved(id, yesWins, price);
    }

    function _fetchOraclePrice(ResolutionConfig memory c) internal view returns (uint256) {
        if (c.oracleType == OracleType.ChainlinkFeed) {
            require(c.oracleAddress != address(0), "zero");
            AggregatorV3Interface feed = AggregatorV3Interface(c.oracleAddress);
            (, int256 p, , uint256 ts, ) = feed.latestRoundData();
            require(p > 0 && block.timestamp - ts < 3600, "stale");
            return uint256(p);
        }
        revert("invalid oracle");
    }

    function _comparePrice(uint256 price, uint256 target, Comparison cmp) internal pure returns (bool) {
        if (cmp == Comparison.Above) return price > target;
        if (cmp == Comparison.Below) return price < target;
        return price == target;
    }

    // ------------------------------------------------------------
    // Redemption
    // ------------------------------------------------------------
    function redeem(uint256 id, bool isYes, uint256 tokensIn) external nonReentrant {
        Market storage m = markets[id];
        require(m.exists, "not found");
        require(m.resolution.isResolved, "not resolved");
        require(tokensIn > 0, "zero");
        require(isYes == m.resolution.yesWins, "not winning side");

        if (isYes) {
            IERC20(address(m.yes)).safeTransferFrom(msg.sender, address(this), tokensIn);
            m.yes.burn(address(this), tokensIn);
        } else {
            IERC20(address(m.no)).safeTransferFrom(msg.sender, address(this), tokensIn);
            m.no.burn(address(this), tokensIn);
        }

        uint256 usdcOut = tokensIn / 1e12; // 18 -> 6
        require(usdcOut > 0, "too small");
        require(usdcOut <= m.usdcVault, "insufficient vault");

        m.usdcVault -= usdcOut;
        m.totalPairsUSDC -= usdcOut;
        usdc.safeTransfer(msg.sender, usdcOut);

        emit Redeemed(id, msg.sender, isYes, tokensIn, usdcOut);
    }

    // ------------------------------------------------------------
    // View helpers for resolver (the ones you said were missing)
    // ------------------------------------------------------------
    function checkUpkeep(uint256 id) external view returns (bool upkeepNeeded, bytes memory performData) {
        Market storage m = markets[id];
        upkeepNeeded =
            m.exists &&
            m.status == MarketStatus.Active &&
            !m.resolution.isResolved &&
            block.timestamp >= m.resolution.expiryTimestamp &&
            m.resolution.oracleType != OracleType.None;
        performData = abi.encode(id);
    }

    function getMarketResolution(uint256 id) external view returns (ResolutionConfig memory) {
        require(markets[id].exists, "not found");
        return markets[id].resolution;
    }
}
