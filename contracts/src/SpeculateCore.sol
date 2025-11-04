// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "./PositionToken.sol";

/**
 * @title SpeculateCore
 * @notice Linear AMM for binary prediction markets
 */
contract SpeculateCore is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant MARKET_CREATOR_ROLE = keccak256("MARKET_CREATOR_ROLE");
    
    uint256 private constant USDC_TO_E18 = 1e12; // 6 decimals -> 18 decimals
    uint256 public constant MAX_USDC_PER_TRADE = 100_000e6; // 100k USDC soft limit per trade

    enum MarketStatus {
        Active,
        Paused,
        Resolved
    }

    struct Market {
        PositionToken yes;
        PositionToken no;
        uint256 reserveYes;        // 18 decimals
        uint256 reserveNo;         // 18 decimals
        uint256 usdcVault;         // 6 decimals
        uint256 totalPairsUSDC;    // 6 decimals
        uint16 feeTreasuryBps;     // % fee to treasury (e.g. 100 = 1%)
        uint16 feeVaultBps;        // % fee to vault buffer (e.g. 50 = 0.5%)
        uint16 feeLpBps;           // % fee to liquidity providers (e.g. 50 = 0.5%)
        uint16 maxTradeBps;        // e.g., 500 = 5% of pool per trade
        MarketStatus status;
        bool exists;
        bool sellFees;             // true = charge sell fees, false = no sell fees
        string question;
        address lp;                 // market creator / LP address
    }

    IERC20 public immutable usdc;
    address public treasury;
    mapping(uint256 => Market) public markets;
    uint256 public marketCount;

    event MarketCreated(
        uint256 indexed id,
        address yes,
        address no,
        string question,
        uint256 reserveYes,
        uint256 reserveNo,
        uint256 usdcVault
    );
    event BuyYes(uint256 indexed id, address indexed user, uint256 usdcIn, uint256 tokensOut, uint256 priceE6);
    event BuyNo(uint256 indexed id, address indexed user, uint256 usdcIn, uint256 tokensOut, uint256 priceE6);
    event SellYes(uint256 indexed id, address indexed user, uint256 tokensIn, uint256 usdcOut, uint256 priceE6);
    event SellNo(uint256 indexed id, address indexed user, uint256 tokensIn, uint256 usdcOut, uint256 priceE6);
    event FeeCollected(uint256 indexed id, address indexed trader, uint256 feeTreasury, uint256 feeVault, uint256 feeLp, bool isBuy);

    constructor(address _usdc, address _treasury) {
        require(_usdc != address(0), "zero usdc");
        require(_treasury != address(0), "zero treasury");
        usdc = IERC20(_usdc);
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MARKET_CREATOR_ROLE, msg.sender);
    }

    function setTreasury(address _treasury) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_treasury != address(0), "zero treasury");
        treasury = _treasury;
    }

    function setFees(uint256 id, uint16 newTreasuryBps, uint16 newVaultBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].exists, "market not found");
        require(newTreasuryBps + newVaultBps <= 1000, "total fee too high");
        markets[id].feeTreasuryBps = newTreasuryBps;
        markets[id].feeVaultBps = newVaultBps;
    }

    function setSellFees(uint256 id, bool enabled) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].exists, "market not found");
        markets[id].sellFees = enabled;
    }

    function setAllFees(uint256 id, uint16 treasuryBps, uint16 vaultBps, uint16 lpBps) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].exists, "market not found");
        require(treasuryBps + vaultBps + lpBps <= 1000, "total fee too high");
        markets[id].feeTreasuryBps = treasuryBps;
        markets[id].feeVaultBps = vaultBps;
        markets[id].feeLpBps = lpBps;
    }

    function grantMarketCreator(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(MARKET_CREATOR_ROLE, account);
    }

    function createMarket(
        string memory question,
        string memory yesName,
        string memory yesSymbol,
        string memory noName,
        string memory noSymbol,
        uint256 initReserveE18,    // e.g. 1000e18
        uint16 feeBps,
        uint16 maxTradeBps,
        uint256 initUsdc           // e.g. 1000e6
    ) external onlyRole(MARKET_CREATOR_ROLE) returns (uint256 id) {
        require(feeBps <= 1000, "fee too high");
        require(maxTradeBps > 0 && maxTradeBps <= 10000, "invalid maxTradeBps");
        require(initUsdc >= 1e6, "min 1 USDC");
        require(initReserveE18 >= 1e18, "min reserve");

        id = ++marketCount;

        // Deploy tokens
        PositionToken yes = new PositionToken(yesName, yesSymbol, address(this));
        PositionToken no = new PositionToken(noName, noSymbol, address(this));

        // Grant roles to this contract
        yes.grantRole(yes.MINTER_ROLE(), address(this));
        yes.grantRole(yes.BURNER_ROLE(), address(this));
        no.grantRole(no.MINTER_ROLE(), address(this));
        no.grantRole(no.BURNER_ROLE(), address(this));

        Market storage m = markets[id];
        m.yes = yes;
        m.no = no;
        m.reserveYes = initReserveE18;
        m.reserveNo = initReserveE18;
        m.feeTreasuryBps = 100;    // 1% to treasury
        m.feeVaultBps = 50;         // 0.5% to vault buffer
        m.feeLpBps = 50;             // 0.5% to liquidity providers
        m.maxTradeBps = maxTradeBps;
        m.status = MarketStatus.Active;
        m.exists = true;
        m.sellFees = false;         // disable sell fees by default
        m.question = question;
        m.lp = msg.sender;          // creator is LP

        // Pull real liquidity
        usdc.safeTransferFrom(msg.sender, address(this), initUsdc);
        m.usdcVault = initUsdc;
        m.totalPairsUSDC = initUsdc;

        // Mint inventory to contract so it matches reserves
        yes.mint(address(this), initReserveE18);
        no.mint(address(this), initReserveE18);

        emit MarketCreated(id, address(yes), address(no), question, initReserveE18, initReserveE18, initUsdc);
    }

    function spotPriceYesE6(uint256 id) public view returns (uint256) {
        Market storage m = markets[id];
        require(m.exists, "market not found");
        uint256 tot = m.reserveYes + m.reserveNo;
        if (tot == 0) return 5e5; // 0.5
        return (m.reserveNo * 1e6) / tot;
    }

    function spotPriceNoE6(uint256 id) public view returns (uint256) {
        Market storage m = markets[id];
        require(m.exists, "market not found");
        uint256 tot = m.reserveYes + m.reserveNo;
        if (tot == 0) return 5e5; // 0.5
        return (m.reserveYes * 1e6) / tot;
    }

    function _buy(uint256 id, bool isYes, uint256 usdcIn)
        internal
        returns (uint256 tokensOut, uint256 priceE6)
    {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Active, "not active");
        require(usdcIn > 0, "zero");
        require(usdcIn <= MAX_USDC_PER_TRADE, "trade exceeds soft limit");

        usdc.safeTransferFrom(msg.sender, address(this), usdcIn);

        // Split fee: treasury, vault buffer, and LP
        uint256 feeTreasury = (usdcIn * m.feeTreasuryBps) / 10000;
        uint256 feeVault = (usdcIn * m.feeVaultBps) / 10000;
        uint256 feeLp = (usdcIn * m.feeLpBps) / 10000;
        uint256 totalFee = feeTreasury + feeVault + feeLp;
        uint256 netUsdc = usdcIn - totalFee;

        // Send treasury fee
        if (feeTreasury > 0) {
            usdc.safeTransfer(treasury, feeTreasury);
        }

        // Send LP fee
        if (feeLp > 0 && m.lp != address(0)) {
            usdc.safeTransfer(m.lp, feeLp);
        }

        // Vault buffer stays inside the vault — effectively increases liquidity
        // Note: feeVault is already in the contract, so we just add it to vault accounting

        // 1) price
        priceE6 = isYes ? spotPriceYesE6(id) : spotPriceNoE6(id);
        require(priceE6 > 0, "bad price");

        // 2) tokensOut precise
        uint256 tokens = Math.mulDiv(netUsdc, 1e18, priceE6);

        // 3) update reserves
        uint256 pairsE18 = netUsdc * USDC_TO_E18;

        if (isYes) {
            m.reserveNo += pairsE18;
            require(m.reserveYes >= tokens, "YES inv underflow");
            m.reserveYes -= tokens;
            m.yes.mint(msg.sender, tokens);
        } else {
            m.reserveYes += pairsE18;
            require(m.reserveNo >= tokens, "NO inv underflow");
            m.reserveNo -= tokens;
            m.no.mint(msg.sender, tokens);
        }

        // 4) sync vault (netUsdc + feeVault = total amount staying in vault)
        m.usdcVault += netUsdc;
        m.usdcVault += feeVault;  // Vault buffer increases liquidity
        m.totalPairsUSDC += netUsdc;
        m.totalPairsUSDC += feeVault;

        // 5) Recompute price after updates (post-trade price)
        priceE6 = isYes ? spotPriceYesE6(id) : spotPriceNoE6(id);

        // 6) Sanity check: vault consistency
        assert(m.usdcVault <= usdc.balanceOf(address(this)));

        // 7) Emit fee event
        emit FeeCollected(id, msg.sender, feeTreasury, feeVault, feeLp, true);

        // 8) return
        tokensOut = tokens;
    }

    function buyYes(uint256 id, uint256 usdcIn, uint256 minOut) external nonReentrant {
        (uint256 out, uint256 priceE6) = _buy(id, true, usdcIn);
        require(out >= minOut, "slip");
        emit BuyYes(id, msg.sender, usdcIn, out, priceE6);
    }

    function buyNo(uint256 id, uint256 usdcIn, uint256 minOut) external nonReentrant {
        (uint256 out, uint256 priceE6) = _buy(id, false, usdcIn);
        require(out >= minOut, "slip");
        emit BuyNo(id, msg.sender, usdcIn, out, priceE6);
    }

    function _sell(uint256 id, bool isYes, uint256 tokensIn)
        internal
        returns (uint256 usdcOut, uint256 priceE6)
    {
        Market storage m = markets[id];
        require(m.status == MarketStatus.Active, "not active");
        require(tokensIn > 0, "zero");

        // Pull tokens
        if (isYes) {
            IERC20(address(m.yes)).safeTransferFrom(msg.sender, address(this), tokensIn);
        } else {
            IERC20(address(m.no)).safeTransferFrom(msg.sender, address(this), tokensIn);
        }

        // Price
        priceE6 = isYes ? spotPriceYesE6(id) : spotPriceNoE6(id);

        // Gross usdc
        uint256 grossUsdc = Math.mulDiv(tokensIn, priceE6, 1e18);
        
        // Soft trade limit (USDC-based)
        require(grossUsdc <= MAX_USDC_PER_TRADE, "trade exceeds soft limit");

        // Solvency check
        require(grossUsdc <= m.usdcVault, "insufficient vault");

        // Reserves updates
        uint256 pairsE18 = grossUsdc * USDC_TO_E18;
        if (isYes) {
            m.reserveYes += tokensIn;
            require(m.reserveNo >= pairsE18, "NO inv underflow");
            m.reserveNo -= pairsE18;
        } else {
            m.reserveNo += tokensIn;
            require(m.reserveYes >= pairsE18, "YES inv underflow");
            m.reserveYes -= pairsE18;
        }

        // --- if sell fees are enabled for this market ---
        if (m.sellFees) {
            uint256 feeTreasury = (grossUsdc * m.feeTreasuryBps) / 10000;
            uint256 feeVault = (grossUsdc * m.feeVaultBps) / 10000;
            uint256 feeLp = (grossUsdc * m.feeLpBps) / 10000;
            uint256 payout = grossUsdc - (feeTreasury + feeVault + feeLp);

            // Vault accounting: money leaving = payout + feeTreasury + feeLp, money staying = feeVault
            m.usdcVault = m.usdcVault - payout - feeTreasury - feeLp + feeVault;
            m.totalPairsUSDC = m.totalPairsUSDC - payout - feeTreasury - feeLp + feeVault;

            usdc.safeTransfer(msg.sender, payout);
            if (feeTreasury > 0) {
                usdc.safeTransfer(treasury, feeTreasury);
            }
            if (feeLp > 0 && m.lp != address(0)) {
                usdc.safeTransfer(m.lp, feeLp);
            }

            // Emit fee event
            emit FeeCollected(id, msg.sender, feeTreasury, feeVault, feeLp, false);
            usdcOut = payout;
        } else {
            // --- fee-free sell ---
            m.usdcVault -= grossUsdc;
            m.totalPairsUSDC -= grossUsdc;
            usdc.safeTransfer(msg.sender, grossUsdc);
            usdcOut = grossUsdc;
        }

        // Recompute price after updates (post-trade price)
        priceE6 = isYes ? spotPriceYesE6(id) : spotPriceNoE6(id);
    }

    function sellYes(uint256 id, uint256 tokensIn, uint256 minUsdcOut) external nonReentrant {
        (uint256 out, uint256 priceE6) = _sell(id, true, tokensIn);
        require(out >= minUsdcOut, "slip");
        emit SellYes(id, msg.sender, tokensIn, out, priceE6);
    }

    function sellNo(uint256 id, uint256 tokensIn, uint256 minUsdcOut) external nonReentrant {
        (uint256 out, uint256 priceE6) = _sell(id, false, tokensIn);
        require(out >= minUsdcOut, "slip");
        emit SellNo(id, msg.sender, tokensIn, out, priceE6);
    }

    function pauseMarket(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].status == MarketStatus.Active, "not active");
        markets[id].status = MarketStatus.Paused;
    }

    function unpauseMarket(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].status == MarketStatus.Paused, "not paused");
        markets[id].status = MarketStatus.Active;
    }

    function resolveMarket(uint256 id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].status == MarketStatus.Active || markets[id].status == MarketStatus.Paused, "already resolved");
        markets[id].status = MarketStatus.Resolved;
    }

    /**
     * @notice Grant MINTER_ROLE on a market's PositionTokens to an address
     * @dev Allows admins to grant minting permissions for emergency or administrative purposes
     * @param id Market ID
     * @param to Address to grant MINTER_ROLE to
     * @param isYes If true, grant on YES token; if false, grant on NO token
     */
    function grantMinterRole(uint256 id, address to, bool isYes) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].exists, "market not found");
        require(to != address(0), "zero address");
        
        PositionToken token = isYes ? markets[id].yes : markets[id].no;
        token.grantRole(token.MINTER_ROLE(), to);
    }

    /**
     * @notice Grant MINTER_ROLE on both PositionTokens to an address
     * @dev Convenience function to grant minting permissions on both YES and NO tokens
     * @param id Market ID
     * @param to Address to grant MINTER_ROLE to
     */
    function grantMinterRoleBoth(uint256 id, address to) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(markets[id].exists, "market not found");
        require(to != address(0), "zero address");
        
        markets[id].yes.grantRole(markets[id].yes.MINTER_ROLE(), to);
        markets[id].no.grantRole(markets[id].no.MINTER_ROLE(), to);
    }
}
