// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "forge-std/console2.sol";

import {SpeculateCore} from "../src/SpeculateCore.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PositionToken} from "../src/PositionToken.sol";

contract SpeculateCoreRoundTripTest is Test {
    MockUSDC internal usdc;
    SpeculateCore internal core;
    address internal treasury = address(0xBEEF);

    function setUp() public {
        usdc = new MockUSDC();
        core = new SpeculateCore(address(usdc), treasury);

        // Give the test contract plenty of USDC and approve the core
        usdc.mint(address(this), 20_000e6);
        usdc.approve(address(core), type(uint256).max);
    }

    function testCreateMarketBuyAndSellRoundTrip() public {
        uint256 initReserve = 1_000e18;
        uint16 feeBps = 150; // 1.50%
        uint16 maxTradeBps = 5_000; // 50%
        uint256 initUsdc = 10_000e6;
        uint256 expiry = block.timestamp + 30 days;

        console2.log("=== Creating Market ===");
        uint256 marketId = core.createMarket(
            "Will BTC close above 100k by EOY?",
            "Yes",
            "YES",
            "No",
            "NO",
            initReserve,
            feeBps,
            maxTradeBps,
            initUsdc,
            expiry,
            SpeculateCore.OracleType.None,
            address(0),
            bytes32(0),
            0,
            SpeculateCore.Comparison.Equals
        );

        console2.log("Market ID", marketId);

        (
            address yesTokenAddr,
            address noTokenAddr,
            uint256 reserveYes,
            uint256 reserveNo,
            uint256 usdcVault,
            uint256 totalPairsUSDC,
            uint16 feeTreasury,
            uint16 feeVault,
            uint16 feeLP,
            uint16 maxTrade,
            SpeculateCore.MarketStatus status,
            bool exists,
            bool sellFees,
            string memory question,
            address lp,
            SpeculateCore.ResolutionConfig memory resolution
        ) = core.markets(marketId);

        _logMarketState(
            "Initial",
            reserveYes,
            reserveNo,
            usdcVault,
            totalPairsUSDC,
            feeTreasury,
            feeVault,
            feeLP,
            maxTrade,
            status,
            exists,
            sellFees,
            question,
            lp,
            resolution
        );

        PositionToken yesToken = PositionToken(yesTokenAddr);
        PositionToken noToken = PositionToken(noTokenAddr);

        uint256 startingUsdc = usdc.balanceOf(address(this));
        console2.log("Trader USDC balance before trades", startingUsdc);

        console2.log("=== Buying YES for 5,000 USDC ===");
        uint256 buyAmount = 5_000e6;
        core.buyYes(marketId, buyAmount, 0);

        uint256 yesBalanceAfterBuy = yesToken.balanceOf(address(this));
        uint256 usdcAfterBuy = usdc.balanceOf(address(this));
        console2.log("YES tokens received", yesBalanceAfterBuy);
        console2.log("USDC spent", startingUsdc - usdcAfterBuy);

        (
            ,
            ,
            uint256 reserveYesAfterBuy,
            uint256 reserveNoAfterBuy,
            uint256 usdcVaultAfterBuy,
            uint256 totalPairsUSCDAfterBuy,
            uint16 feeTreasuryAfterBuy,
            uint16 feeVaultAfterBuy,
            uint16 feeLPAfterBuy,
            uint16 maxTradeAfterBuy,
            SpeculateCore.MarketStatus statusAfterBuy,
            bool existsAfterBuy,
            bool sellFeesAfterBuy,
            string memory questionAfterBuy,
            address lpAfterBuy,
            SpeculateCore.ResolutionConfig memory resolutionAfterBuy
        ) = core.markets(marketId);

        _logMarketState(
            "Post-buy",
            reserveYesAfterBuy,
            reserveNoAfterBuy,
            usdcVaultAfterBuy,
            totalPairsUSCDAfterBuy,
            feeTreasuryAfterBuy,
            feeVaultAfterBuy,
            feeLPAfterBuy,
            maxTradeAfterBuy,
            statusAfterBuy,
            existsAfterBuy,
            sellFeesAfterBuy,
            questionAfterBuy,
            lpAfterBuy,
            resolutionAfterBuy
        );

        console2.log("=== Selling all YES immediately ===");
        core.sellYes(marketId, yesBalanceAfterBuy, 0);

        uint256 finalUsdc = usdc.balanceOf(address(this));
        uint256 yesBalanceAfterSell = yesToken.balanceOf(address(this));
        uint256 noBalanceAfterSell = noToken.balanceOf(address(this));

        console2.log("USDC received on sell", finalUsdc - usdcAfterBuy);
        console2.log("USDC net from round-trip", finalUsdc - startingUsdc);
        console2.log("YES balance after sell", yesBalanceAfterSell);
        console2.log("NO balance after sell", noBalanceAfterSell);

        (
            ,
            ,
            uint256 reserveYesAfterSell,
            uint256 reserveNoAfterSell,
            uint256 usdcVaultAfterSell,
            uint256 totalPairsUSCDAfterSell,
            uint16 feeTreasuryAfterSell,
            uint16 feeVaultAfterSell,
            uint16 feeLPAfterSell,
            uint16 maxTradeAfterSell,
            SpeculateCore.MarketStatus statusAfterSell,
            bool existsAfterSell,
            bool sellFeesAfterSell,
            string memory questionAfterSell,
            address lpAfterSell,
            SpeculateCore.ResolutionConfig memory resolutionAfterSell
        ) = core.markets(marketId);

        _logMarketState(
            "Post-sell",
            reserveYesAfterSell,
            reserveNoAfterSell,
            usdcVaultAfterSell,
            totalPairsUSCDAfterSell,
            feeTreasuryAfterSell,
            feeVaultAfterSell,
            feeLPAfterSell,
            maxTradeAfterSell,
            statusAfterSell,
            existsAfterSell,
            sellFeesAfterSell,
            questionAfterSell,
            lpAfterSell,
            resolutionAfterSell
        );

        // Sanity check: we should have zero YES after selling everything
        assertEq(yesBalanceAfterSell, 0, "YES balance should be zero after full sell");
    }

    function _logMarketState(
        string memory label,
        uint256 reserveYes,
        uint256 reserveNo,
        uint256 usdcVault,
        uint256 totalPairsUSDC,
        uint16 feeTreasury,
        uint16 feeVault,
        uint16 feeLP,
        uint16 maxTrade,
        SpeculateCore.MarketStatus status,
        bool exists,
        bool sellFees,
        string memory question,
        address lp,
        SpeculateCore.ResolutionConfig memory resolution
    ) internal view {
        console2.log(string.concat("--- Market State: ", label, " ---"));
        console2.log("Reserve YES", reserveYes);
        console2.log("Reserve NO", reserveNo);
        console2.log("USDC vault", usdcVault);
        console2.log("totalPairsUSDC", totalPairsUSDC);
        console2.log("Fees (treasury,vault,lp)", feeTreasury, feeVault, feeLP);
        console2.log("Max trade BPS", maxTrade);
        console2.log("Status", uint256(status));
        console2.log("Exists?", exists);
        console2.log("Sell fees enabled?", sellFees);
        console2.log("Question", question);
        console2.log("LP address", lp);
        console2.log("Resolution expiry", resolution.expiryTimestamp);
        console2.log("Resolution oracle type", uint256(resolution.oracleType));
    }
}
