// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

/**
 * @notice Script to set SpeculateCore address on MockUSDC
 * @dev Run this after deploying SpeculateCore to enable admin minting
 * Usage: forge script script/SetSpeculateCoreOnUSDC.s.sol:SetSpeculateCoreOnUSDC --rpc-url <rpc> --broadcast
 */
contract SetSpeculateCoreOnUSDC is Script {
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

        // Get addresses from environment or use defaults
        address usdcAddr = vm.envOr("USDC_ADDRESS", address(0x0E5cB1F812ce0402fdF0c9cee2E1FE3BF351a827));
        address coreAddr = vm.envOr("CORE_ADDRESS", address(0x83438B43dAFfe80e67Ca7204eaEe4674d0EF6BBe));
        
        MockUSDC usdc = MockUSDC(usdcAddr);
        
        console.log("USDC Address:", address(usdc));
        console.log("SpeculateCore Address:", coreAddr);
        console.log("Calling setSpeculateCore...");
        
        usdc.setSpeculateCore(coreAddr);
        
        console.log("Successfully set SpeculateCore address on MockUSDC");
        console.log("Admins from SpeculateCore can now mint USDC");

        vm.stopBroadcast();
    }
}

