// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SpeculateCore} from "../src/SpeculateCore.sol";
import {ChainlinkResolver} from "../src/ChainlinkResolver.sol";

/**
 * @title DeployUpdatedResolver
 * @notice Deploy updated ChainlinkResolver with dynamic market checking
 * @dev Updates existing SpeculateCore to use new resolver
 */
contract DeployUpdatedResolver is Script {
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
        console.log("\n=== DEPLOYING UPDATED CHAINLINK RESOLVER ===\n");
        console.log("Deployer address:", deployer);

        // Get existing SpeculateCore address
        address coreAddress = vm.envOr("SPECULATE_CORE_ADDRESS", address(0));
        require(coreAddress != address(0), "SPECULATE_CORE_ADDRESS not set in environment");
        console.log("Using existing SpeculateCore at:", coreAddress);
        
        SpeculateCore core = SpeculateCore(coreAddress);

        // Deploy new ChainlinkResolver (with dynamic market checking)
        console.log("\n--- Deploying Updated ChainlinkResolver ---");
        ChainlinkResolver resolver = new ChainlinkResolver(address(core));
        console.log("New ChainlinkResolver deployed at:", address(resolver));

        // Update SpeculateCore to use new resolver
        console.log("\n--- Updating SpeculateCore ---");
        core.setChainlinkResolver(address(resolver));
        console.log("Updated SpeculateCore to use new resolver");

        console.log("\n=== DEPLOYMENT COMPLETE ===\n");
        console.log("SpeculateCore:", address(core));
        console.log("New ChainlinkResolver:", address(resolver));
        console.log("\nNext steps:");
        console.log("1. Update .env file with new resolver address:");
        console.log("   CHAINLINK_RESOLVER_ADDRESS=", address(resolver));
        console.log("2. Create ONE Chainlink Automation upkeep (checkData = empty)");
        console.log("3. All markets will be checked automatically!");

        vm.stopBroadcast();
    }
}

