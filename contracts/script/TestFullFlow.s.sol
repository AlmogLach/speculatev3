// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockUSDC.sol";
import "../src/DirectCore.sol";
import "../src/PositionToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title TestFullFlow
 * @notice Full end-to-end test: Create market, buy YES/NO, sell YES/NO, verify everything works
 */
contract TestFullFlow is Script {
    address public ADMIN;
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

        console.log("\n=== FULL FLOW TEST: CREATE -> BUY -> SELL ===\n");

        // Step 1: Deploy contracts (if not already deployed)
        MockUSDC usdc = MockUSDC(0xF0D8e40068AA5368581Cc6B251E6C2a4aa51E7a3);
        DirectCore core = DirectCore(0xFc648ebeb2118be2598eb6fc008D4c94b7Ba0Ba3);
        
        console.log("USDC:", address(usdc));
        console.log("DirectCore:", address(core));
        console.log("Admin:", ADMIN);
        console.log("Sensitivity:", core.sensitivityE18());

        // Step 2: Mint USDC to admin
        console.log("\n--- STEP 1: MINT USDC ---");
        usdc.mint(ADMIN, 10_000 * ONE_E6);
        uint256 adminUsdc = usdc.balanceOf(ADMIN);
        console.log("Admin USDC balance:", adminUsdc / ONE_E6);

        // Step 3: Approve USDC to core
        console.log("\n--- STEP 2: APPROVE USDC ---");
        usdc.approve(address(core), type(uint256).max);
        uint256 allowance = usdc.allowance(ADMIN, address(core));
        console.log("USDC allowance:", allowance / ONE_E6);

        // Step 4: Create market
        console.log("\n--- STEP 3: CREATE MARKET ---");
        console.log("Creating market with:");
        console.log("  - Fee: 3% (300 bps)");
        console.log("  - Initial Price: 0.5 (50% YES, 50% NO)");
        console.log("  - NO initial liquidity required!");
        
        uint256 marketId = core.createMarket(
            address(usdc),
            "Will BTC reach $100k by 2025?",
            block.timestamp + 30 days,
            300, // 3% fee
            5e17 // 0.5 = 50%
        );
        console.log("Market ID:", marketId);
        
        // Get market details
        // DirectCore markets() returns: [usdc, yes, no, usdcVault, feeBps, priceYesE18, feeUSDC, question, expiry, creator, status, yesWins]
        (MockUSDC mUsdc, PositionToken yesToken, PositionToken noToken, uint256 vault, uint16 feeBps, uint256 priceYesE18, uint256 feeUSDC, string memory question, uint256 expiry, address creator, DirectCore.Status status, bool yesWins) = core.markets(marketId);
        console.log("Market created:");
        console.log("  - Question:", question);
        console.log("  - YES Token:", address(yesToken));
        console.log("  - NO Token:", address(noToken));
        console.log("  - Initial Vault:", vault / ONE_E6);
        console.log("  - Fee Rate:", feeBps, "bps");
        console.log("  - Initial Price YES:", priceYesE18);
        console.log("  - Initial Price NO:", (ONE_E18 - priceYesE18));
        console.log("  - Status:", status == DirectCore.Status.Active ? "Active" : status == DirectCore.Status.Paused ? "Paused" : "Resolved");
        console.log("  - Accumulated Fees:", feeUSDC / ONE_E6);
        
        IERC20 yesTokenERC = IERC20(yesToken);
        IERC20 noTokenERC = IERC20(noToken);

        // Step 5: Approve position tokens for selling
        console.log("\n--- STEP 4: APPROVE POSITION TOKENS (for selling later) ---");
        yesTokenERC.approve(address(core), type(uint256).max);
        noTokenERC.approve(address(core), type(uint256).max);
        console.log("YES token approved");
        console.log("NO token approved");

        // Step 6: Buy YES tokens
        console.log("\n--- STEP 5: BUY 100 USDC of YES TOKENS ---");
        uint256 buyYesAmount = 100 * ONE_E6;
        uint256 yesTokensBefore = yesTokenERC.balanceOf(ADMIN);
        console.log("Buying:", buyYesAmount / ONE_E6, "USDC");
        
        (uint256 priceYesBefore, uint256 priceNoBefore) = _getPrices(core, marketId);
        console.log("Price BEFORE buy:");
        console.log("  - YES:", (priceYesBefore * 100) / ONE_E18, "%");
        console.log("  - NO:", (priceNoBefore * 100) / ONE_E18, "%");
        
        uint256 tokensOut = core.buy(marketId, true, buyYesAmount);
        console.log("Tokens received:", tokensOut / ONE_E18);
        
        uint256 yesTokensAfter = yesTokenERC.balanceOf(ADMIN);
        console.log("YES balance before:", yesTokensBefore / ONE_E18);
        console.log("YES balance after:", yesTokensAfter / ONE_E18);
        console.log("YES tokens received:", (yesTokensAfter - yesTokensBefore) / ONE_E18);
        
        (mUsdc, yesToken, noToken, vault, feeBps, priceYesE18, feeUSDC,,,,,) = core.markets(marketId);
        console.log("Market state AFTER buy:");
        console.log("  - Vault:", vault / ONE_E6, "USDC");
        console.log("  - Accumulated Fees:", feeUSDC / ONE_E6, "USDC");
        
        (uint256 priceYesAfter, uint256 priceNoAfter) = _getPrices(core, marketId);
        console.log("Price AFTER buy:");
        console.log("  - YES:", (priceYesAfter * 100) / ONE_E18, "%");
        console.log("  - NO:", (priceNoAfter * 100) / ONE_E18, "%");
        console.log("  - Price moved:", ((priceYesAfter > priceYesBefore ? priceYesAfter - priceYesBefore : priceYesBefore - priceYesAfter) * 100) / ONE_E18, "%");

        // Step 7: Buy NO tokens
        console.log("\n--- STEP 6: BUY 50 USDC of NO TOKENS ---");
        uint256 buyNoAmount = 50 * ONE_E6;
        uint256 noTokensBefore = noTokenERC.balanceOf(ADMIN);
        console.log("Buying:", buyNoAmount / ONE_E6, "USDC");
        
        (priceYesBefore, priceNoBefore) = _getPrices(core, marketId);
        console.log("Price BEFORE buy:");
        console.log("  - YES:", (priceYesBefore * 100) / ONE_E18, "%");
        console.log("  - NO:", (priceNoBefore * 100) / ONE_E18, "%");
        
        tokensOut = core.buy(marketId, false, buyNoAmount);
        console.log("Tokens received:", tokensOut / ONE_E18);
        
        uint256 noTokensAfter = noTokenERC.balanceOf(ADMIN);
        console.log("NO balance before:", noTokensBefore / ONE_E18);
        console.log("NO balance after:", noTokensAfter / ONE_E18);
        console.log("NO tokens received:", (noTokensAfter - noTokensBefore) / ONE_E18);
        
        (mUsdc, yesToken, noToken, vault, feeBps, priceYesE18, feeUSDC,,,,,) = core.markets(marketId);
        console.log("Market state AFTER buy:");
        console.log("  - Vault:", vault / ONE_E6, "USDC");
        console.log("  - Accumulated Fees:", feeUSDC / ONE_E6, "USDC");
        
        (priceYesAfter, priceNoAfter) = _getPrices(core, marketId);
        console.log("Price AFTER buy:");
        console.log("  - YES:", (priceYesAfter * 100) / ONE_E18, "%");
        console.log("  - NO:", (priceNoAfter * 100) / ONE_E18, "%");

        // Step 8: Sell all YES tokens
        console.log("\n--- STEP 7: SELL ALL YES TOKENS ---");
        uint256 yesToSell = yesTokenERC.balanceOf(ADMIN);
        console.log("Selling:", yesToSell / ONE_E18, "YES tokens");
        
        uint256 adminUsdcBefore = usdc.balanceOf(ADMIN);
        (priceYesBefore, priceNoBefore) = _getPrices(core, marketId);
        console.log("Price BEFORE sell:");
        console.log("  - YES:", (priceYesBefore * 100) / ONE_E18, "%");
        console.log("  - NO:", (priceNoBefore * 100) / ONE_E18, "%");
        
        uint256 usdcOut = core.sell(marketId, true, yesToSell);
        console.log("USDC received (gross):", usdcOut / ONE_E6);
        
        uint256 adminUsdcAfter = usdc.balanceOf(ADMIN);
        uint256 netUsdcReceived = adminUsdcAfter - adminUsdcBefore;
        console.log("Admin USDC before:", adminUsdcBefore / ONE_E6);
        console.log("Admin USDC after:", adminUsdcAfter / ONE_E6);
        console.log("Net USDC received:", netUsdcReceived / ONE_E6);
        
        (mUsdc, yesToken, noToken, vault, feeBps, priceYesE18, feeUSDC,,,,,) = core.markets(marketId);
        console.log("Market state AFTER sell:");
        console.log("  - Vault:", vault / ONE_E6, "USDC");
        console.log("  - Accumulated Fees:", feeUSDC / ONE_E6, "USDC");
        
        (priceYesAfter, priceNoAfter) = _getPrices(core, marketId);
        console.log("Price AFTER sell:");
        console.log("  - YES:", (priceYesAfter * 100) / ONE_E18, "%");
        console.log("  - NO:", (priceNoAfter * 100) / ONE_E18, "%");

        // Step 9: Sell all NO tokens
        console.log("\n--- STEP 8: SELL ALL NO TOKENS ---");
        uint256 noToSell = noTokenERC.balanceOf(ADMIN);
        console.log("Selling:", noToSell / ONE_E18, "NO tokens");
        
        adminUsdcBefore = usdc.balanceOf(ADMIN);
        (priceYesBefore, priceNoBefore) = _getPrices(core, marketId);
        console.log("Price BEFORE sell:");
        console.log("  - YES:", (priceYesBefore * 100) / ONE_E18, "%");
        console.log("  - NO:", (priceNoBefore * 100) / ONE_E18, "%");
        
        usdcOut = core.sell(marketId, false, noToSell);
        console.log("USDC received (gross):", usdcOut / ONE_E6);
        
        adminUsdcAfter = usdc.balanceOf(ADMIN);
        netUsdcReceived = adminUsdcAfter - adminUsdcBefore;
        console.log("Admin USDC before:", adminUsdcBefore / ONE_E6);
        console.log("Admin USDC after:", adminUsdcAfter / ONE_E6);
        console.log("Net USDC received:", netUsdcReceived / ONE_E6);
        
        (mUsdc, yesToken, noToken, vault, feeBps, priceYesE18, feeUSDC,,,,,) = core.markets(marketId);
        console.log("Market state AFTER sell:");
        console.log("  - Vault:", vault / ONE_E6, "USDC");
        console.log("  - Accumulated Fees:", feeUSDC / ONE_E6, "USDC");
        
        (priceYesAfter, priceNoAfter) = _getPrices(core, marketId);
        console.log("Price AFTER sell:");
        console.log("  - YES:", (priceYesAfter * 100) / ONE_E18, "%");
        console.log("  - NO:", (priceNoAfter * 100) / ONE_E18, "%");

        // Step 10: Final Summary
        console.log("\n=== FINAL SUMMARY ===");
        uint256 totalSpent = buyYesAmount + buyNoAmount;
        uint256 finalUsdc = usdc.balanceOf(ADMIN);
        uint256 initialUsdc = 10_000 * ONE_E6;
        int256 netChange = int256(finalUsdc) - int256(initialUsdc);
        
        console.log("Initial USDC:", initialUsdc / ONE_E6);
        console.log("Total spent (buy):", totalSpent / ONE_E6);
        console.log("Final USDC:", finalUsdc / ONE_E6);
        console.log("Net change:", netChange < 0 ? uint256(-netChange) / ONE_E6 : 0, "USDC lost");
        console.log("Final Vault:", vault / ONE_E6, "USDC");
        console.log("Total Fees Collected:", feeUSDC / ONE_E6, "USDC");
        console.log("Final Price YES:", (priceYesAfter * 100) / ONE_E18, "%");
        console.log("Final Price NO:", (priceNoAfter * 100) / ONE_E18, "%");
        
        console.log("\n=== HOW IT WORKS ===");
        console.log("1. CREATE MARKET: No liquidity needed! Just set initial price (0.5 = 50/50)");
        console.log("2. BUY YES: Pay USDC -> Get YES tokens at current price -> Price moves up");
        console.log("3. BUY NO: Pay USDC -> Get NO tokens at current price -> Price moves down");
        console.log("4. SELL YES: Return YES tokens -> Get USDC at current price -> Price moves down");
        console.log("5. SELL NO: Return NO tokens -> Get USDC at current price -> Price moves up");
        console.log("6. VAULT: Holds USDC from buys, pays out on sells");
        console.log("7. FEES: 3% taken on both buy and sell, accumulated in market");

        vm.stopBroadcast();
    }

    function _getPrices(DirectCore core, uint256 marketId) internal view returns (uint256 priceYes, uint256 priceNo) {
        priceYes = core.priceYesE18(marketId);
        priceNo = core.priceNoE18(marketId);
    }
}

