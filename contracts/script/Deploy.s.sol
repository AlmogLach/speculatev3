// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {DirectCore} from "../src/DirectCore.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract Deploy is Script {
    function run() external {
        string memory privateKeyStr = vm.envString("PRIVATE_KEY");
        uint256 deployerPrivateKey;
        if (bytes(privateKeyStr)[0] == bytes1("0") && bytes(privateKeyStr)[1] == bytes1("x")) {
            // Has 0x prefix
            deployerPrivateKey = vm.parseUint(privateKeyStr);
        } else {
            // No 0x prefix
            string memory keyWithPrefix = string.concat("0x", privateKeyStr);
            deployerPrivateKey = vm.parseUint(keyWithPrefix);
        }
        vm.startBroadcast(deployerPrivateKey);

        // Deploy MockUSDC
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // Deploy DirectCore
        DirectCore core = new DirectCore();
        console.log("DirectCore deployed at:", address(core));
        
        // Add additional admin
        address additionalAdmin = 0x654704a85211ECf9E021ff4D25a3a35533b99732;
        core.addAdmin(additionalAdmin);
        console.log("Additional admin added:", additionalAdmin);
        console.log("Is admin?", core.admins(additionalAdmin));

        vm.stopBroadcast();
    }
}

