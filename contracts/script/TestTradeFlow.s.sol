// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SpeculateCore} from "../src/SpeculateCore.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PositionToken} from "../src/PositionToken.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestTradeFlow is Script {
    function run() external {
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey;
        if (bytes(privateKeyStr)[0] == bytes1("0") && bytes(privateKeyStr)[1] == bytes1("x")) {
            deployerPrivateKey = vm.parseUint(privateKeyStr);
        } else {
            string memory keyWithPrefix = string.concat("0x", privateKeyStr);
            deployerPrivateKey = vm.parseUint(keyWithPrefix);
        }
        vm.startBroadcast(deployerPrivateKey);

        // Get contract addresses from environment or use defaults
        address usdcAddr = vm.envOr("USDC_ADDRESS", address(0x94C1e25E6eD7B24674fe77f13fF24a57542CCCDB));
        address coreAddr = vm.envOr("CORE_ADDRESS", address(0xD891d6Ae53670e28574fC33333C981ACB1e3a40b));
        uint256 marketId = vm.envOr("MARKET_ID", uint256(1));
        
        MockUSDC usdc = MockUSDC(usdcAddr);
        SpeculateCore core = SpeculateCore(coreAddr);
        
        // Temporary variables for market state
        SpeculateCore.MarketStatus statusTemp;
        bool existsTemp;
        bool sellFeesTemp;
        address lpTemp;
        uint16 skip;

        console.log("=== Starting Trade Flow Test ===");
        console.log("USDC Address:", address(usdc));
        console.log("Core Address:", address(core));
        console.log("Market ID:", marketId);
        console.log("Deployer:", vm.addr(deployerPrivateKey));

        // Get market data
        (PositionToken yesToken, PositionToken noToken, uint256 reserveYes, uint256 reserveNo, uint256 usdcVault, uint256 totalPairsUSDC, uint16 feeTreasuryBps, uint16 feeVaultBps, uint16 feeLpBps, uint16 maxTradeBps, SpeculateCore.MarketStatus status, bool exists, bool sellFees, string memory question, address lp) = core.markets(marketId);
        
        console.log("\n=== Initial Market State ===");
        console.log("Question:", question);
        console.log("YES Token:", address(yesToken));
        console.log("NO Token:", address(noToken));
        console.log("Reserve YES:", reserveYes);
        console.log("Reserve NO:", reserveNo);
        console.log("USDC Vault:", usdcVault);
        console.log("Total Pairs USDC:", totalPairsUSDC);
        console.log("Fee Treasury BPS:", feeTreasuryBps);
        console.log("Fee Vault BPS:", feeVaultBps);
        console.log("Fee LP BPS:", feeLpBps);
        console.log("Max Trade BPS:", maxTradeBps);
        console.log("Sell Fees Enabled:", sellFees);
        console.log("LP Address:", address(lp));
        console.log("Spot Price YES (E6):", core.spotPriceYesE6(marketId));
        console.log("Spot Price NO (E6):", core.spotPriceNoE6(marketId));

        // Calculate max trade size: maxTradeBps% of side reserve
        // With reserve = 1000e18 and maxTradeBps = 500 (5%), max = 50e18 tokens
        // At price 0.5 (500000 E6): max USDC = 50e18 * 500000 / 1e18 = 25e6 USDC (before fees)
        // With 3% fee: max USDC = 25e6 / 0.97 ≈ 25.77e6 USDC
        // Use 25 USDC to be safe
        uint256 tradeAmount = 25 * 1e6; // 25 USDC (within 5% limit)
        console.log("\n=== Trade Amount: 25 USDC (within 5% max trade limit) ===");

        // Ensure we have enough USDC
        uint256 balance = usdc.balanceOf(vm.addr(deployerPrivateKey));
        if (balance < tradeAmount * 2) {
            console.log("Minting additional USDC...");
            usdc.mint(vm.addr(deployerPrivateKey), tradeAmount * 2);
        }
        console.log("Deployer USDC Balance:", usdc.balanceOf(vm.addr(deployerPrivateKey)) / 1e6);

        // ===== BUY YES =====
        console.log("\n=== Step 1: Buying YES with 50 USDC ===");
        
        // Approve USDC
        usdc.approve(address(core), tradeAmount);
        console.log("Approved USDC for core");
        
        // Get initial YES balance
        uint256 yesBalanceBefore = yesToken.balanceOf(vm.addr(deployerPrivateKey));
        console.log("YES Balance Before:", yesBalanceBefore);
        
        // Buy YES
        uint256 minOutYes = 0; // Set slippage tolerance later
        core.buyYes(marketId, tradeAmount, minOutYes);
        console.log("Buy YES transaction completed");
        
        // Get YES balance after
        uint256 yesBalanceAfter = yesToken.balanceOf(vm.addr(deployerPrivateKey));
        uint256 yesTokensReceived = yesBalanceAfter - yesBalanceBefore;
        console.log("YES Balance After:", yesBalanceAfter);
        console.log("YES Tokens Received:", yesTokensReceived);

        // Get market state after YES buy
        (,, reserveYes, reserveNo, usdcVault, totalPairsUSDC, skip, skip, skip, skip, statusTemp, existsTemp, sellFeesTemp,, lpTemp) = core.markets(marketId);
        console.log("Market State After YES Buy:");
        console.log("  Reserve YES:", reserveYes);
        console.log("  Reserve NO:", reserveNo);
        console.log("  USDC Vault:", usdcVault);
        console.log("  Total Pairs USDC:", totalPairsUSDC);
        console.log("  Spot Price YES (E6):", core.spotPriceYesE6(marketId));
        console.log("  Spot Price NO (E6):", core.spotPriceNoE6(marketId));

        // ===== BUY NO =====
        console.log("\n=== Step 2: Buying NO with 50 USDC ===");
        
        // Approve USDC (may need more)
        usdc.approve(address(core), tradeAmount * 2);
        console.log("Approved USDC for core");
        
        // Get initial NO balance
        uint256 noBalanceBefore = noToken.balanceOf(vm.addr(deployerPrivateKey));
        console.log("NO Balance Before:", noBalanceBefore);
        
        // Buy NO
        uint256 minOutNo = 0;
        core.buyNo(marketId, tradeAmount, minOutNo);
        console.log("Buy NO transaction completed");
        
        // Get NO balance after
        uint256 noBalanceAfter = noToken.balanceOf(vm.addr(deployerPrivateKey));
        uint256 noTokensReceived = noBalanceAfter - noBalanceBefore;
        console.log("NO Balance After:", noBalanceAfter);
        console.log("NO Tokens Received:", noTokensReceived);

        // Get market state after NO buy
        (,, reserveYes, reserveNo, usdcVault, totalPairsUSDC, skip, skip, skip, skip, statusTemp, existsTemp, sellFeesTemp,, lpTemp) = core.markets(marketId);
        console.log("Market State After NO Buy:");
        console.log("  Reserve YES:", reserveYes);
        console.log("  Reserve NO:", reserveNo);
        console.log("  USDC Vault:", usdcVault);
        console.log("  Total Pairs USDC:", totalPairsUSDC);
        console.log("  Spot Price YES (E6):", core.spotPriceYesE6(marketId));
        console.log("  Spot Price NO (E6):", core.spotPriceNoE6(marketId));

        // ===== SELL YES =====
        console.log("\n=== Step 3: Selling YES Tokens ===");
        
        // Approve YES token
        IERC20(address(yesToken)).approve(address(core), yesTokensReceived);
        console.log("Approved YES token for core");
        
        // Get USDC balance before
        uint256 usdcBalanceBeforeSellYes = usdc.balanceOf(vm.addr(deployerPrivateKey));
        console.log("USDC Balance Before Sell YES:", usdcBalanceBeforeSellYes / 1e6);
        
        // Sell YES
        uint256 minUsdcOutYes = 0;
        core.sellYes(marketId, yesTokensReceived, minUsdcOutYes);
        console.log("Sell YES transaction completed");
        
        // Get USDC balance after
        uint256 usdcBalanceAfterSellYes = usdc.balanceOf(vm.addr(deployerPrivateKey));
        uint256 usdcReceivedFromYes = usdcBalanceAfterSellYes - usdcBalanceBeforeSellYes;
        console.log("USDC Balance After Sell YES:", usdcBalanceAfterSellYes / 1e6);
        console.log("USDC Received from YES:", usdcReceivedFromYes / 1e6);

        // Get market state after YES sell
        (,, reserveYes, reserveNo, usdcVault, totalPairsUSDC, skip, skip, skip, skip, statusTemp, existsTemp, sellFeesTemp,, lpTemp) = core.markets(marketId);
        console.log("Market State After YES Sell:");
        console.log("  Reserve YES:", reserveYes);
        console.log("  Reserve NO:", reserveNo);
        console.log("  USDC Vault:", usdcVault);
        console.log("  Total Pairs USDC:", totalPairsUSDC);
        console.log("  Spot Price YES (E6):", core.spotPriceYesE6(marketId));
        console.log("  Spot Price NO (E6):", core.spotPriceNoE6(marketId));

        // ===== SELL NO =====
        console.log("\n=== Step 4: Selling NO Tokens ===");
        
        // Approve NO token
        IERC20(address(noToken)).approve(address(core), noTokensReceived);
        console.log("Approved NO token for core");
        
        // Get USDC balance before
        uint256 usdcBalanceBeforeSellNo = usdc.balanceOf(vm.addr(deployerPrivateKey));
        console.log("USDC Balance Before Sell NO:", usdcBalanceBeforeSellNo / 1e6);
        
        // Sell NO
        uint256 minUsdcOutNo = 0;
        core.sellNo(marketId, noTokensReceived, minUsdcOutNo);
        console.log("Sell NO transaction completed");
        
        // Get USDC balance after
        uint256 usdcBalanceAfterSellNo = usdc.balanceOf(vm.addr(deployerPrivateKey));
        uint256 usdcReceivedFromNo = usdcBalanceAfterSellNo - usdcBalanceBeforeSellNo;
        console.log("USDC Balance After Sell NO:", usdcBalanceAfterSellNo / 1e6);
        console.log("USDC Received from NO:", usdcReceivedFromNo / 1e6);

        // ===== FINAL MARKET STATE =====
        console.log("\n=== Final Market State ===");
        (,, reserveYes, reserveNo, usdcVault, totalPairsUSDC, feeTreasuryBps, feeVaultBps, feeLpBps, maxTradeBps, status, exists, sellFees, question, lp) = core.markets(marketId);
        console.log("Question:", question);
        console.log("Reserve YES:", reserveYes);
        console.log("Reserve NO:", reserveNo);
        console.log("USDC Vault:", usdcVault);
        console.log("Total Pairs USDC:", totalPairsUSDC);
        console.log("Fee Treasury BPS:", feeTreasuryBps);
        console.log("Fee Vault BPS:", feeVaultBps);
        console.log("Fee LP BPS:", feeLpBps);
        console.log("Max Trade BPS:", maxTradeBps);
        console.log("Sell Fees Enabled:", sellFees);
        console.log("LP Address:", address(lp));
        console.log("Status:", uint8(status));
        console.log("Exists:", exists);
        console.log("Spot Price YES (E6):", core.spotPriceYesE6(marketId));
        console.log("Spot Price NO (E6):", core.spotPriceNoE6(marketId));

        // ===== SUMMARY =====
        console.log("\n=== Trade Summary ===");
        console.log("Initial USDC spent:", (tradeAmount * 2) / 1e6);
        console.log("USDC received from YES:", usdcReceivedFromYes / 1e6);
        console.log("USDC received from NO:", usdcReceivedFromNo / 1e6);
        console.log("Total USDC received:", (usdcReceivedFromYes + usdcReceivedFromNo) / 1e6);
        
        uint256 netUsdc = usdcReceivedFromYes + usdcReceivedFromNo;
        uint256 totalSpent = tradeAmount * 2;
        uint256 feesPaid = totalSpent > netUsdc ? (totalSpent - netUsdc) : 0;
        console.log("Total fees paid:", feesPaid / 1e6);
        
        int256 netResult = int256(netUsdc) - int256(totalSpent);
        console.log("Net USDC result:", netResult / 1e6);
        
        uint256 initialVault = 1000 * 1e6;
        int256 vaultChange = int256(usdcVault) - int256(initialVault);
        console.log("Vault change from initial 1000 USDC:", vaultChange / 1e6);
        console.log("Vault should be approximately:", initialVault / 1e6, "(minus fees)");
        console.log("Expected vault loss due to fees:", feesPaid / 1e6);

        vm.stopBroadcast();
    }
}

