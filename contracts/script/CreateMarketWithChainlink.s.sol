// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/SpeculateCore.sol";
import "../src/ChainlinkResolver.sol";

/**
 * @title CreateMarketWithChainlink
 * @notice Create a market with Chainlink price feed resolution
 * @dev Example: "Will BTC be above $50,000?"
 */
contract CreateMarketWithChainlink is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        bytes memory bs = bytes(pkStr);
        uint256 key = (bs.length >= 2 && bs[0] == bytes1("0") && bs[1] == bytes1("x"))
            ? vm.parseUint(pkStr)
            : vm.parseUint(string(abi.encodePacked("0x", pkStr)));
        address creator = vm.addr(key);
        vm.startBroadcast(key);

        console.log("\n=== CREATE MARKET WITH CHAINLINK ===\n");

        // Get addresses from environment
        address coreAddress = vm.envOr("SPECULATE_CORE_ADDRESS", address(0));
        address resolverAddress = vm.envOr("CHAINLINK_RESOLVER_ADDRESS", address(0));
        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0));
        
        require(coreAddress != address(0), "SPECULATE_CORE_ADDRESS not set");
        require(resolverAddress != address(0), "CHAINLINK_RESOLVER_ADDRESS not set");
        require(usdcAddress != address(0), "USDC_ADDRESS not set");

        SpeculateCore core = SpeculateCore(coreAddress);
        ChainlinkResolver resolver = ChainlinkResolver(resolverAddress);

        // Market parameters
        string memory question = "Will BTC be above $50,000?";
        uint256 expiryTimestamp = block.timestamp + 7 days; // Expires in 7 days
        
        // Chainlink Price Feed (BTC/USD on BSC Testnet)
        // Update this address based on your network
        address btcPriceFeed = vm.envOr(
            "BTC_PRICE_FEED_ADDRESS",
            address(0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf) // BSC Testnet default
        );
        
        uint256 targetValue = 50000e8; // $50,000 with 8 decimals (Chainlink feeds use 8 decimals)
        SpeculateCore.Comparison comparison = SpeculateCore.Comparison.Above;

        console.log("Question:", question);
        console.log("Expiry:", expiryTimestamp);
        console.log("Price Feed:", btcPriceFeed);
        console.log("Target Value:", targetValue);
        console.log("Comparison: Above");

        // Market creation parameters
        uint256 initReserveE18 = 1000e18;
        uint16 feeBps = 200; // 2%
        uint16 maxTradeBps = 500; // 5%
        uint256 initUsdc = 1000e6; // 1000 USDC

        // Create market
        console.log("\n--- Creating Market ---");
        uint256 marketId = core.createMarket(
            question,
            "BTC Above 50k YES",
            "BTC50K-YES",
            "BTC Above 50k NO",
            "BTC50K-NO",
            initReserveE18,
            feeBps,
            maxTradeBps,
            initUsdc,
            expiryTimestamp,
            SpeculateCore.OracleType.ChainlinkFeed,
            btcPriceFeed,
            bytes32(0), // priceFeedId not used for feeds
            targetValue,
            comparison
        );

        console.log("Market created with ID:", marketId);

        // Register market in resolver
        console.log("\n--- Registering Market in Resolver ---");
        resolver.registerMarket(marketId, btcPriceFeed);
        console.log("Market registered in resolver");

        console.log("\n=== MARKET CREATED ===\n");
        console.log("Market ID:", marketId);
        console.log("Question:", question);
        console.log("Expiry:", expiryTimestamp);
        console.log("Price Feed:", btcPriceFeed);
        console.log("\nNext steps:");
        console.log("1. Register upkeep on Chainlink Automation with market ID:", marketId);
        console.log("2. Fund upkeep with LINK tokens");
        console.log("3. Market will auto-resolve when expiry is reached");

        vm.stopBroadcast();
    }
}

