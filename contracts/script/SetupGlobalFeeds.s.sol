// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ChainlinkResolver} from "../src/ChainlinkResolver.sol";

/**
 * @title SetupGlobalFeeds
 * @notice Register global Chainlink price feeds in the resolver
 * @dev Run this after deploying ChainlinkResolver to register common feeds
 */
contract SetupGlobalFeeds is Script {
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

        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer address:", deployer);

        // Get resolver address from environment
        address resolverAddress = vm.envOr("CHAINLINK_RESOLVER_ADDRESS", address(0));
        require(resolverAddress != address(0), "CHAINLINK_RESOLVER_ADDRESS not set");
        
        ChainlinkResolver resolver = ChainlinkResolver(resolverAddress);
        console.log("ChainlinkResolver:", resolverAddress);

        // BSC Testnet Chainlink Price Feed addresses
        // You can find more at: https://docs.chain.link/data-feeds/price-feeds/addresses?network=bsc-testnet
        
        // Register common feeds
        bytes32 btcUsd = keccak256("BTC/USD");
        address btcFeed = 0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf; // BTC/USD on BSC Testnet
        resolver.setGlobalFeed(btcUsd, btcFeed);
        console.log("Registered BTC/USD feed:", btcFeed);

        bytes32 ethUsd = keccak256("ETH/USD");
        address ethFeed = 0x143db3CEEfbdfe5631aDD3E50f7614B6ba708BA7; // ETH/USD on BSC Testnet
        resolver.setGlobalFeed(ethUsd, ethFeed);
        console.log("Registered ETH/USD feed:", ethFeed);

        bytes32 bnbUsd = keccak256("BNB/USD");
        address bnbFeed = 0x2514895c72f50D8bd4B4F9b1110F0D6bD2c97526; // BNB/USD on BSC Testnet
        resolver.setGlobalFeed(bnbUsd, bnbFeed);
        console.log("Registered BNB/USD feed:", bnbFeed);

        console.log("\n=== GLOBAL FEEDS REGISTERED ===");
        console.log("BTC/USD:", btcFeed);
        console.log("ETH/USD:", ethFeed);
        console.log("BNB/USD:", bnbFeed);
        console.log("\nYou can now create markets using these feed IDs:");
        console.log("  - keccak256('BTC/USD')");
        console.log("  - keccak256('ETH/USD')");
        console.log("  - keccak256('BNB/USD')");

        vm.stopBroadcast();
    }
}

