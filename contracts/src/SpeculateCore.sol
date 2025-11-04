// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MockUSDC.sol";
import "./PositionToken.sol";

/**
 * @title SpeculateCore
 * @notice CPMM with constant virtual reserves (amplification). Mint/burn pairs ensure solvency.
 */
contract SpeculateCore {
    // -------- Reentrancy guard --------
    uint256 private _locked;
    modifier nonReentrant() {
        require(_locked == 0, "reentrancy");
        _locked = 1;
        _;
        _locked = 0;
    }

    enum Status { Active, Paused, Resolved }

    struct Market {
        MockUSDC usdc;
        PositionToken yes;
        PositionToken no;

        uint256 reserveYes; // 18 decimals
        uint256 reserveNo;  // 18 decimals
        uint256 k;          // (reserveYes+vYes)*(reserveNo+vNo)

        uint256 virtualYes; // constant
        uint256 virtualNo;  // constant

        uint256 usdcVault;  // 6 decimals
        uint256 totalPairs; // 6 decimals (1:1 with usdcVault)
        uint256 feeUSDC;    // 6 decimals - accumulated fees for this market

        string question;
        uint256 expiry;
        address creator;
        uint16 feeBps;      // e.g., 100 = 1%
        Status status;
        bool yesWins;
    }

    address public admin;
    address public treasury;
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    uint256 public totalFees;

    uint256 private constant ONE_E18 = 1e18;
    uint256 private constant ONE_E6 = 1e6;
    uint256 private constant CONVERSION = ONE_E18 / ONE_E6; // 1e12
    uint256 private constant AMPLIFICATION = 5; // virtual = AMPLIFICATION * initial (x5)

    event MarketCreated(uint256 indexed id, address usdc, address yes, address no, uint256 reserveYes, uint256 reserveNo, uint256 usdcVault);
    event TradeBuy(uint256 indexed id, address indexed user, bool isYes, uint256 usdcIn, uint256 fee, uint256 tokensOut);
    event TradeSell(uint256 indexed id, address indexed user, bool isYes, uint256 tokensIn, uint256 usdcOut);
    event PairRedeemed(uint256 indexed id, address indexed user, uint256 pairAmount, uint256 usdcOut);
    event MarketResolved(uint256 indexed id, bool yesWins);
    event MarketPaused(uint256 indexed id);
    event MarketUnpaused(uint256 indexed id);

    constructor() { admin = msg.sender; }

    function _usdcToE18(uint256 x6) internal pure returns (uint256) { return x6 * CONVERSION; }
    function _e18ToUsdc(uint256 x18) internal pure returns (uint256) { return x18 / CONVERSION; }

    modifier onlyAdmin() { require(msg.sender == admin, "not admin"); _; }
    function transferAdmin(address newAdmin) external onlyAdmin { require(newAdmin != address(0), "zero"); admin = newAdmin; }
    function setTreasury(address t) external onlyAdmin { require(t != address(0), "zero"); treasury = t; }
    function updateFeeRate(uint256 id, uint16 newFeeBps) external onlyAdmin { require(newFeeBps <= 1000, "fee"); markets[id].feeBps = newFeeBps; }
    function withdrawFees() external onlyAdmin { uint256 amount = totalFees; totalFees = 0; /* transfer in prod */ }

    modifier onlyActive(uint256 id) { require(markets[id].status == Status.Active, "not active"); _; }
    function pauseMarket(uint256 id) external onlyAdmin { require(markets[id].status == Status.Active, "not active"); markets[id].status = Status.Paused; emit MarketPaused(id); }
    function unpauseMarket(uint256 id) external onlyAdmin { require(markets[id].status == Status.Paused, "not paused"); markets[id].status = Status.Active; emit MarketUnpaused(id); }

    function createMarket(address usdc, uint256 initialLiquidity, string memory question, uint256 expiry, uint16 feeBps) external onlyAdmin returns (uint256 id) {
        require(feeBps <= 1000, "fee");
        require(initialLiquidity >= ONE_E6 * 100, "min 100");
        id = ++marketCount;
        Market storage m = markets[id];

        m.usdc = MockUSDC(usdc);
        m.feeBps = feeBps;
        m.question = question;
        m.expiry = expiry;
        m.creator = msg.sender;
        m.status = Status.Active;

        m.yes = new PositionToken(string(abi.encodePacked(question, " - YES")), "YES", address(this));
        m.no  = new PositionToken(string(abi.encodePacked(question, " - NO")),  "NO",  address(this));
        m.yes.grantRole(m.yes.MINTER_ROLE(), address(this));
        m.yes.grantRole(m.yes.BURNER_ROLE(), address(this));
        m.no.grantRole(m.no.MINTER_ROLE(), address(this));
        m.no.grantRole(m.no.BURNER_ROLE(), address(this));

        require(m.usdc.transferFrom(msg.sender, address(this), initialLiquidity), "xfer");
        m.usdcVault = initialLiquidity;

        uint256 r = _usdcToE18(initialLiquidity);
        m.yes.mint(address(this), r);
        m.no.mint(address(this), r);
        m.reserveYes = r;
        m.reserveNo = r;

        m.virtualYes = r * AMPLIFICATION;
        m.virtualNo = r * AMPLIFICATION;
        m.k = (m.reserveYes + m.virtualYes) * (m.reserveNo + m.virtualNo);
        m.totalPairs = initialLiquidity;

        emit MarketCreated(id, usdc, address(m.yes), address(m.no), m.reserveYes, m.reserveNo, m.usdcVault);
    }

    // Prices based on (reserve + virtual) with constant virtual reserves
    function priceYesE18(uint256 id) external view returns (uint256) {
        Market storage m = markets[id];
        uint256 totalYes = m.reserveYes + m.virtualYes;
        uint256 totalNo = m.reserveNo + m.virtualNo;
        uint256 total = totalYes + totalNo;
        if (total == 0) return 0;
        return (totalNo * ONE_E18) / total;
    }
    function priceNoE18(uint256 id) external view returns (uint256) {
        Market storage m = markets[id];
        uint256 totalYes = m.reserveYes + m.virtualYes;
        uint256 totalNo = m.reserveNo + m.virtualNo;
        uint256 total = totalYes + totalNo;
        if (total == 0) return 0;
        return (totalYes * ONE_E18) / total;
    }

    // BUY: mint pairs, CPMM swap using constant virtual reserves; tokensOut = CPMM delta
    function buy(uint256 id, bool isYes, uint256 usdcIn) external nonReentrant onlyActive(id) returns (uint256 tokensOut) {
        Market storage m = markets[id];
        require(usdcIn > 0, "usdc=0");
        require(m.usdc.transferFrom(msg.sender, address(this), usdcIn), "xfer");

        uint256 fee = (usdcIn * m.feeBps) / 10000; uint256 netUsdc = usdcIn - fee;
        if (treasury != address(0)) {
            require(m.usdc.transfer(treasury, fee), "xfer fee");
        } else {
            m.feeUSDC += fee;
        }
        totalFees += fee;
        uint256 pairsE18 = _usdcToE18(netUsdc);
        m.yes.mint(address(this), pairsE18);
        m.no.mint(address(this), pairsE18);
        m.totalPairs += netUsdc; m.usdcVault += netUsdc;

        uint256 k = (m.reserveYes + m.virtualYes) * (m.reserveNo + m.virtualNo);
        if (isYes) {
            uint256 totalYes = m.reserveYes + m.virtualYes;
            uint256 totalNo = m.reserveNo + m.virtualNo;
            m.reserveNo += pairsE18;
            uint256 newTotalYes = k / (m.reserveNo + m.virtualNo);
            uint256 deltaYes = totalYes > newTotalYes ? totalYes - newTotalYes : 0;
            m.reserveYes = newTotalYes > m.virtualYes ? newTotalYes - m.virtualYes : 0;
            tokensOut = deltaYes;
            require(m.yes.transfer(msg.sender, tokensOut), "xfer yes");
        } else {
            uint256 totalYes = m.reserveYes + m.virtualYes;
            uint256 totalNo = m.reserveNo + m.virtualNo;
            m.reserveYes += pairsE18;
            uint256 newTotalNo = k / (m.reserveYes + m.virtualYes);
            uint256 deltaNo = totalNo > newTotalNo ? totalNo - newTotalNo : 0;
            m.reserveNo = newTotalNo > m.virtualNo ? newTotalNo - m.virtualNo : 0;
            tokensOut = deltaNo;
            require(m.no.transfer(msg.sender, tokensOut), "xfer no");
        }

        m.k = (m.reserveYes + m.virtualYes) * (m.reserveNo + m.virtualNo);
        emit TradeBuy(id, msg.sender, isYes, usdcIn, fee, tokensOut);
    }

    // SELL: CPMM swap, mint opposite to form pairs, burn pairs, pay USDC (gross), fees stay in contract
    function sell(uint256 id, bool isYes, uint256 tokensIn) external nonReentrant onlyActive(id) returns (uint256 usdcOut) {
        Market storage m = markets[id];
        require(tokensIn > 0, "tokens=0");

        uint256 k = (m.reserveYes + m.virtualYes) * (m.reserveNo + m.virtualNo);
        uint256 oppositeTokensNeeded;
        if (isYes) {
            require(m.yes.transferFrom(msg.sender, address(this), tokensIn), "xfer");
            uint256 newTotalYes = (m.reserveYes + m.virtualYes) + tokensIn;
            uint256 newTotalNo = k / newTotalYes;
            oppositeTokensNeeded = (m.reserveNo + m.virtualNo) - newTotalNo;
            m.no.mint(address(this), oppositeTokensNeeded);
            m.reserveYes = newTotalYes - m.virtualYes;
            m.reserveNo = newTotalNo - m.virtualNo;
        } else {
            require(m.no.transferFrom(msg.sender, address(this), tokensIn), "xfer");
            uint256 newTotalNo = (m.reserveNo + m.virtualNo) + tokensIn;
            uint256 newTotalYes = k / newTotalNo;
            oppositeTokensNeeded = (m.reserveYes + m.virtualYes) - newTotalYes;
            m.yes.mint(address(this), oppositeTokensNeeded);
            m.reserveNo = newTotalNo - m.virtualNo;
            m.reserveYes = newTotalYes - m.virtualYes;
        }

        uint256 pairsToBurn = tokensIn < oppositeTokensNeeded ? tokensIn : oppositeTokensNeeded;
        if (isYes) { m.yes.burn(address(this), pairsToBurn); m.no.burn(address(this), pairsToBurn); }
        else { m.no.burn(address(this), pairsToBurn); m.yes.burn(address(this), pairsToBurn); }

        usdcOut = _e18ToUsdc(pairsToBurn);
        uint256 fee = (usdcOut * m.feeBps) / 10000; uint256 netUsdc = usdcOut - fee;
        // Subtract ONLY net from vault/pairs so liquidity reflects tradable funds
        m.totalPairs -= netUsdc; m.usdcVault -= netUsdc;
        assert(m.usdcVault == m.totalPairs);
        // Pay user net and route fee to treasury (or accrue if not set)
        require(m.usdc.transfer(msg.sender, netUsdc), "xfer usdc");
        if (treasury != address(0)) {
            require(m.usdc.transfer(treasury, fee), "xfer fee");
        } else {
            m.feeUSDC += fee;
        }
        totalFees += fee;

        m.k = (m.reserveYes + m.virtualYes) * (m.reserveNo + m.virtualNo);
        emit TradeSell(id, msg.sender, isYes, tokensIn, usdcOut);
    }

    function redeemPairs(uint256 /*id*/, uint256 /*pairAmount*/) external pure returns (uint256) { revert("redeem disabled"); }

    function sweepFees(uint256 id) external onlyAdmin {
        Market storage m = markets[id];
        require(treasury != address(0), "no treasury");
        uint256 amt = m.feeUSDC;
        require(amt > 0, "no fees");
        m.feeUSDC = 0;
        require(m.usdc.transfer(treasury, amt), "xfer");
    }

    function closePosition(uint256 /*id*/, uint256 /*yesIn*/, uint256 /*noIn*/) external pure returns (uint256) { revert("close disabled"); }

    function resolveMarket(uint256 id, bool yesWins) external onlyAdmin {
        Market storage m = markets[id];
        require(m.status == Status.Active, "not active");
        require(block.timestamp > m.expiry, "not expired");
        m.status = Status.Resolved; m.yesWins = yesWins; emit MarketResolved(id, yesWins);
    }
}


