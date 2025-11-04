// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./MockUSDC.sol";
import "./PositionToken.sol";

/**
 * @title DirectCore
 * @notice Direct USDC <-> YES pricing market. NO price = 1 - YES.
 *         Tokens pay 1 USDC per winning token at resolution (if enabled later).
 *         WARNING: This is a prototype that updates price heuristically.
 */
contract DirectCore {
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

        uint256 usdcVault;    // 6 decimals
        uint16 feeBps;        // e.g., 100 = 1%
        uint256 priceYesE18;  // 0..1e18
        uint256 feeUSDC;      // 6 decimals collected

        string question;
        uint256 expiry;
        address creator;
        Status status;
        bool yesWins;
    }

    address public admin; // Legacy single admin for backward compatibility
    mapping(address => bool) public admins; // Multiple admins support
    address public treasury;
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;

    uint256 private constant ONE_E18 = 1e18;
    uint256 private constant ONE_E6 = 1e6;
    uint256 private constant CONVERSION = ONE_E18 / ONE_E6; // 1e12

    // Price update sensitivity (percentage of trade size vs vault), admin-updatable
    // e.g., 0.01e18 = 1% of the trade/vault ratio applied to price move
    uint256 public sensitivityE18 = 1e16; // 0.01

    event MarketCreated(uint256 indexed id, address usdc, address yes, address no, uint256 priceYesE18);
    event TradeBuy(uint256 indexed id, address indexed user, bool isYes, uint256 usdcIn, uint256 fee, uint256 tokensOut);
    event TradeSell(uint256 indexed id, address indexed user, bool isYes, uint256 tokensIn, uint256 usdcOut);
    event MarketPaused(uint256 indexed id);
    event MarketUnpaused(uint256 indexed id);
    event MarketResolved(uint256 indexed id, bool yesWins);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    constructor() { 
        admin = msg.sender;
        admins[msg.sender] = true; // Initialize deployer as admin
    }
    modifier onlyAdmin() { 
        require(msg.sender == admin || admins[msg.sender], "not admin"); 
        _; 
    }
    function transferAdmin(address newAdmin) external onlyAdmin { 
        require(newAdmin != address(0), "zero"); 
        admin = newAdmin;
        admins[newAdmin] = true; // Also add to admins mapping
    }
    function addAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "zero");
        admins[newAdmin] = true;
        emit AdminAdded(newAdmin);
    }
    function removeAdmin(address adminToRemove) external onlyAdmin {
        require(adminToRemove != admin, "cannot remove primary admin");
        require(admins[adminToRemove], "not an admin");
        admins[adminToRemove] = false;
        emit AdminRemoved(adminToRemove);
    }
    function setTreasury(address t) external onlyAdmin { require(t != address(0), "zero"); treasury = t; }
    function setSensitivity(uint256 newSensitivityE18) external onlyAdmin {
        require(newSensitivityE18 >= 1e15 && newSensitivityE18 <= 5e16, "range"); // 0.001 - 0.05
        sensitivityE18 = newSensitivityE18;
    }

    function _usdcToE18(uint256 x6) internal pure returns (uint256) { return x6 * CONVERSION; }
    function _e18ToUsdc(uint256 x18) internal pure returns (uint256) { return x18 / CONVERSION; }

    function createMarket(address usdc, string memory question, uint256 expiry, uint16 feeBps, uint256 initialPriceYesE18) external onlyAdmin returns (uint256 id) {
        require(feeBps <= 1000, "fee");
        require(initialPriceYesE18 > 1e16 && initialPriceYesE18 < ONE_E18 - 1e16, "price");

        id = ++marketCount;
        Market storage m = markets[id];
        m.usdc = MockUSDC(usdc);
        m.feeBps = feeBps;
        m.priceYesE18 = initialPriceYesE18;
        m.feeUSDC = 0;
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

        emit MarketCreated(id, usdc, address(m.yes), address(m.no), m.priceYesE18);
    }

    modifier onlyActive(uint256 id) { require(markets[id].status == Status.Active, "not active"); _; }
    function pauseMarket(uint256 id) external onlyAdmin { require(markets[id].status == Status.Active, "not active"); markets[id].status = Status.Paused; emit MarketPaused(id); }
    function unpauseMarket(uint256 id) external onlyAdmin { require(markets[id].status == Status.Paused, "not paused"); markets[id].status = Status.Active; emit MarketUnpaused(id); }

    function priceYesE18(uint256 id) external view returns (uint256) { return markets[id].priceYesE18; }
    function priceNoE18(uint256 id) external view returns (uint256) { return ONE_E18 - markets[id].priceYesE18; }

    function _clampPrice(uint256 p) internal pure returns (uint256) {
        if (p < 1e16) return 1e16;
        if (p > ONE_E18 - 1e16) return ONE_E18 - 1e16;
        return p;
    }

    function _applyPriceMove(Market storage m, bool isYes, bool isBuy, uint256 netUsdc) internal {
        // delta = SENSITIVITY * (net / max(1, vault + net))
        uint256 denom = m.usdcVault + netUsdc;
        if (denom == 0) return;
        uint256 ratioE18 = (netUsdc * ONE_E18) / denom;
        uint256 deltaE18 = (ratioE18 * sensitivityE18) / ONE_E18;
        if (deltaE18 == 0) return;
        if (isBuy) {
            if (isYes) m.priceYesE18 = _clampPrice(m.priceYesE18 + deltaE18);
            else m.priceYesE18 = _clampPrice(m.priceYesE18 > deltaE18 ? m.priceYesE18 - deltaE18 : 1);
        } else {
            if (isYes) m.priceYesE18 = _clampPrice(m.priceYesE18 > deltaE18 ? m.priceYesE18 - deltaE18 : 1);
            else m.priceYesE18 = _clampPrice(m.priceYesE18 + deltaE18);
        }
    }

    function buy(uint256 id, bool isYes, uint256 usdcIn) external nonReentrant onlyActive(id) returns (uint256 tokensOut) {
        Market storage m = markets[id];
        require(usdcIn > 0, "usdc=0");
        require(m.usdc.transferFrom(msg.sender, address(this), usdcIn), "xfer");

        uint256 fee = (usdcIn * m.feeBps) / 10000;
        uint256 net = usdcIn - fee;
        m.feeUSDC += fee;

        uint256 p = isYes ? m.priceYesE18 : (ONE_E18 - m.priceYesE18);
        require(p > 0, "price");

        // tokensOutE18 = (net(6d) * 1e30) / priceE18
        tokensOut = (_usdcToE18(net) * ONE_E18) / p;

        if (isYes) m.yes.mint(msg.sender, tokensOut);
        else m.no.mint(msg.sender, tokensOut);

        m.usdcVault += net;
        if (treasury != address(0) && fee > 0) {
            require(m.usdc.transfer(treasury, fee), "fee xfer");
        }

        _applyPriceMove(m, isYes, true, net);
        emit TradeBuy(id, msg.sender, isYes, usdcIn, fee, tokensOut);
    }

    function sell(uint256 id, bool isYes, uint256 tokensIn) external nonReentrant onlyActive(id) returns (uint256 usdcOut) {
        Market storage m = markets[id];
        require(tokensIn > 0, "tokens=0");

        if (isYes) { require(m.yes.transferFrom(msg.sender, address(this), tokensIn), "xfer YES"); m.yes.burn(address(this), tokensIn); }
        else { require(m.no.transferFrom(msg.sender, address(this), tokensIn), "xfer NO"); m.no.burn(address(this), tokensIn); }

        uint256 p = isYes ? m.priceYesE18 : (ONE_E18 - m.priceYesE18);
        require(p > 0, "price");

        // grossUSDC = tokensIn * price
        uint256 grossE18 = (tokensIn * p) / ONE_E18;
        uint256 grossUsdc = _e18ToUsdc(grossE18);

        uint256 fee = (grossUsdc * m.feeBps) / 10000;
        uint256 net = grossUsdc - fee;
        m.feeUSDC += fee;

        require(m.usdcVault >= net, "vault");
        m.usdcVault -= net;
        require(m.usdc.transfer(msg.sender, net), "xfer usdc");
        if (treasury != address(0) && fee > 0) {
            require(m.usdc.transfer(treasury, fee), "fee xfer");
        }

        _applyPriceMove(m, isYes, false, net);
        emit TradeSell(id, msg.sender, isYes, tokensIn, grossUsdc);
        return grossUsdc;
    }
}


