// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockUSDC.sol";
import "../src/DirectCore.sol";
import "../src/PositionToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestMarketWithFee is Script {
    address public ADMIN;
    address public USDC_ADDRESS;
    address public DIRECT_CORE_ADDRESS;
    address public TREASURY_ADDRESS;

    uint256 private constant ONE_E18 = 1e18;
    uint256 private constant ONE_E6 = 1e6;

    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        bytes memory bs = bytes(pkStr);
        uint256 key = (bs.length >= 2 && bs[0] == bytes1("0") && bs[1] == bytes1("x"))
            ? vm.parseUint(pkStr)
            : vm.parseUint(string(abi.encodePacked("0x", pkStr)));
        ADMIN = vm.addr(key);
        vm.startBroadcast(key);

        console.log("=== TESTING MARKET WITH 3% FEE ===");
        console.log("Admin address:", ADMIN);

        // Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        USDC_ADDRESS = address(usdc);
        console.log("\n[1] MockUSDC deployed:", USDC_ADDRESS);

        // Deploy DirectCore
        DirectCore directCore = new DirectCore();
        DIRECT_CORE_ADDRESS = address(directCore);
        console.log("[2] DirectCore deployed:", DIRECT_CORE_ADDRESS);

        // Deploy Treasury (optional, but good for fee collection)
        // Treasury treasury = new Treasury(ADMIN);
        // TREASURY_ADDRESS = address(treasury);
        // directCore.setTreasury(TREASURY_ADDRESS);
        // console.log("[3] Treasury deployed:", TREASURY_ADDRESS);

        // Mint USDC to admin for testing
        uint256 mintAmt = 1_000_000 * ONE_E6; // 1,000,000 USDC
        usdc.mint(ADMIN, mintAmt);
        console.log("[4] Minted USDC to ADMIN:", usdc.balanceOf(ADMIN) / ONE_E6);

        // Approve core for trades
        usdc.approve(DIRECT_CORE_ADDRESS, type(uint256).max);
        console.log("[5] USDC approved to DirectCore");

        // Create market with 3% fee (300 basis points)
        uint256 expiry = block.timestamp + 30 days;
        uint16 feeBps = 300; // 3%
        uint256 initialPriceYesE18 = 5e17; // 0.5 (50% YES / 50% NO)

        console.log("\n[6] Creating market with:");
        console.log("    - Fee: 3% (300 bps)");
        console.log("    - Initial Price: 0.5 (50% YES / 50% NO)");
        console.log("    - Expiry:", expiry);

        uint256 marketId = directCore.createMarket(
            USDC_ADDRESS,
            "Test Market with 3% Fee",
            expiry,
            feeBps,
            initialPriceYesE18
        );
        console.log("\n[7] Market created! Market ID:", marketId);

        // Get token addresses
        (
            MockUSDC mUsdc,
            PositionToken yesToken,
            PositionToken noToken,
            uint256 usdcVault,
            uint16 feeBpsOut,
            uint256 priceYesE18,
            uint256 feeUSDC,
            string memory question,
            uint256 expiryTime,
            address creator,
            DirectCore.Status status,
            bool yesWins
        ) = directCore.markets(marketId);
        
        address yesTokenAddr = address(yesToken);
        address noTokenAddr = address(noToken);

        console.log("\n[8] Market details:");
        console.log("    YES Token:", yesTokenAddr);
        console.log("    NO Token:", noTokenAddr);
        console.log("    Fee BPS:", feeBpsOut);
        console.log("    Initial Price YES:", priceYesE18);

        // --- Initial State ---
        console.log("\n=== INITIAL STATE ===");
        _logMarketState(marketId, directCore);
        _logUserBalances(ADMIN, usdc, yesTokenAddr, noTokenAddr);

        // --- Buy YES 100 USDC ---
        console.log("\n=== BUYING YES TOKENS ===");
        uint256 buyYesAmount = 100 * ONE_E6; // 100 USDC
        console.log("Buying YES with:", buyYesAmount / ONE_E6, "USDC");

        uint256 yesTokensOut = directCore.buy(marketId, true, buyYesAmount);
        console.log("Received YES tokens:", yesTokensOut);

        _logMarketState(marketId, directCore);
        _logUserBalances(ADMIN, usdc, yesTokenAddr, noTokenAddr);

        // Calculate expected: (100 USDC - 3% fee) / price = 97 USDC / 0.5 = 194 tokens
        uint256 netUsdc = (buyYesAmount * 97) / 100; // After 3% fee
        uint256 expectedYesTokens = (netUsdc * ONE_E18) / priceYesE18;
        console.log("Expected YES tokens (approx):", expectedYesTokens);
        console.log("Actual tokens received:", yesTokensOut);
        console.log("Difference:", yesTokensOut > expectedYesTokens ? (yesTokensOut - expectedYesTokens) : (expectedYesTokens - yesTokensOut));

        // --- Buy NO 100 USDC ---
        console.log("\n=== BUYING NO TOKENS ===");
        uint256 buyNoAmount = 100 * ONE_E6; // 100 USDC
        console.log("Buying NO with:", buyNoAmount / ONE_E6, "USDC");

        // Get current price before buy
        (,,,,,uint256 priceYesBeforeBuy,,,,,,) = directCore.markets(marketId);
        uint256 priceNoBeforeBuy = ONE_E18 - priceYesBeforeBuy;
        console.log("Price NO before buy:", priceNoBeforeBuy);

        uint256 noTokensOut = directCore.buy(marketId, false, buyNoAmount);
        console.log("Received NO tokens:", noTokensOut);

        _logMarketState(marketId, directCore);
        _logUserBalances(ADMIN, usdc, yesTokenAddr, noTokenAddr);

        // --- Approve tokens for selling ---
        console.log("\n=== APPROVING TOKENS FOR SELLING ===");
        PositionToken(yesTokenAddr).approve(DIRECT_CORE_ADDRESS, type(uint256).max);
        PositionToken(noTokenAddr).approve(DIRECT_CORE_ADDRESS, type(uint256).max);
        console.log("YES and NO tokens approved to DirectCore");

        // --- Sell NO tokens (partial) ---
        console.log("\n=== SELLING NO TOKENS ===");
        uint256 sellNoAmount = noTokensOut / 2; // Sell half
        console.log("Selling NO tokens:", sellNoAmount);

        // Get price before sell
        (,,,,,uint256 priceYesBeforeSell,,,,,,) = directCore.markets(marketId);
        uint256 priceNoBeforeSell = ONE_E18 - priceYesBeforeSell;
        console.log("Price NO before sell:", priceNoBeforeSell);

        uint256 grossUsdcOutNo = directCore.sell(marketId, false, sellNoAmount);
        console.log("Gross USDC received:", grossUsdcOutNo / ONE_E6);
        console.log("Expected net (after 3% fee):", (grossUsdcOutNo * 97) / 100 / ONE_E6);

        _logMarketState(marketId, directCore);
        _logUserBalances(ADMIN, usdc, yesTokenAddr, noTokenAddr);

        // --- Sell YES tokens (partial) ---
        console.log("\n=== SELLING YES TOKENS ===");
        uint256 sellYesAmount = yesTokensOut / 2; // Sell half
        console.log("Selling YES tokens:", sellYesAmount);

        // Get price before sell
        (,,,,,uint256 priceYesBeforeSell2,,,,,,) = directCore.markets(marketId);
        console.log("Price YES before sell:", priceYesBeforeSell2);

        uint256 grossUsdcOutYes = directCore.sell(marketId, true, sellYesAmount);
        console.log("Gross USDC received:", grossUsdcOutYes / ONE_E6);
        console.log("Expected net (after 3% fee):", (grossUsdcOutYes * 97) / 100 / ONE_E6);

        _logMarketState(marketId, directCore);
        _logUserBalances(ADMIN, usdc, yesTokenAddr, noTokenAddr);

        // --- Final Summary ---
        console.log("\n=== FINAL SUMMARY ===");
        uint256 totalSpent = buyYesAmount + buyNoAmount;
        uint256 grossReceived = grossUsdcOutNo + grossUsdcOutYes;
        
        // Calculate fees from contract events
        // Buy fees: 3% of each buy = 3 USDC each = 6 USDC total
        uint256 buyFees = (buyYesAmount * 300) / 10000 + (buyNoAmount * 300) / 10000; // 3% = 300 bps
        
        // Sell fees: 3% of gross received
        // The contract returns gross USDC, but user receives net (after 3% fee)
        uint256 sellFees = (grossUsdcOutNo * 300) / 10000 + (grossUsdcOutYes * 300) / 10000;
        uint256 netReceived = grossReceived - sellFees;
        uint256 totalFees = buyFees + sellFees;
        
        int256 netChange = int256(netReceived) - int256(totalSpent);
        
        console.log("=== BREAKDOWN ===");
        console.log("Total USDC spent (buy):", totalSpent / ONE_E6);
        console.log("  - Buy YES: 100 USDC -> Fee: 3 USDC (3%)");
        console.log("  - Buy NO: 100 USDC -> Fee: 3 USDC (3%)");
        console.log("  - Total buy fees:", buyFees / ONE_E6, "USDC");
        
        console.log("\nTotal USDC received (sell, GROSS):", grossReceived / ONE_E6);
        console.log("  - Sell NO gross:", grossUsdcOutNo / ONE_E6, "USDC");
        console.log("  - Sell YES gross:", grossUsdcOutYes / ONE_E6, "USDC");
        console.log("\nTotal USDC received (sell, NET after 3% fee):", netReceived / ONE_E6);
        console.log("  - Sell NO fee:", (grossUsdcOutNo * 300) / 10000 / ONE_E6, "USDC");
        console.log("  - Sell YES fee:", (grossUsdcOutYes * 300) / 10000 / ONE_E6, "USDC");
        console.log("  - Total sell fees:", sellFees / ONE_E6, "USDC");
        
        console.log("\n=== FEES SUMMARY ===");
        console.log("Buy fees:", buyFees / ONE_E6);
        console.log("Sell fees:", sellFees / ONE_E6);
        console.log("Total fees paid:", totalFees / ONE_E6);
        console.log("\n=== NET RESULT ===");
        console.log("Total USDC spent:", totalSpent / ONE_E6);
        console.log("Total USDC received (net):", netReceived / ONE_E6);
        console.log("Net USDC loss:", netChange < 0 ? uint256(-netChange) / ONE_E6 : 0);
        
        (,,,,,uint256 finalPriceYes,,,,,,) = directCore.markets(marketId);
        console.log("Final Price YES:", finalPriceYes);
        console.log("Final Price NO:", ONE_E18 - finalPriceYes);

        _logMarketState(marketId, directCore);
        _logUserBalances(ADMIN, usdc, yesTokenAddr, noTokenAddr);

        vm.stopBroadcast();
    }

    function _logMarketState(uint256 id, DirectCore core) internal view {
        (
            MockUSDC mUsdc,
            PositionToken yesToken,
            PositionToken noToken,
            uint256 usdcVault,
            uint16 feeBpsOut,
            uint256 priceYesE18,
            uint256 feeUSDC,
            string memory question,
            uint256 expiry,
            address creator,
            DirectCore.Status status,
            bool yesWins
        ) = core.markets(id);

        uint256 priceNoE18 = ONE_E18 - priceYesE18;

        console.log("  Market State:");
        console.log("    Vault:", usdcVault / ONE_E6, "USDC");
        console.log("    Fee BPS:", feeBpsOut);
        console.log("    Accumulated Fees:", feeUSDC / ONE_E6, "USDC");
        console.log("    Price YES (E18):", priceYesE18);
        console.log("    Price NO (E18):", priceNoE18);
        console.log("    Price YES (%):", (priceYesE18 * 100) / ONE_E18);
        console.log("    Price NO (%):", (priceNoE18 * 100) / ONE_E18);
        console.log("    Status:", uint256(status));
    }

    function _logUserBalances(address user, MockUSDC usdc, address yesToken, address noToken) internal view {
        console.log("  User Balances:");
        console.log("    USDC:", usdc.balanceOf(user) / ONE_E6);
        console.log("    YES tokens:", IERC20(yesToken).balanceOf(user));
        console.log("    NO tokens:", IERC20(noToken).balanceOf(user));
    }
}

