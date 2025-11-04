// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SpeculateCore} from "../src/SpeculateCore.sol";
import {MockUSDC} from "../src/MockUSDC.sol";

contract CreateTestMarket is Script {
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
        address usdcAddr = vm.envAddress("USDC_ADDRESS");
        address coreAddr = vm.envAddress("CORE_ADDRESS");
        
        MockUSDC usdc = MockUSDC(usdcAddr);
        SpeculateCore core = SpeculateCore(coreAddr);

        // Approve USDC for market creation
        uint256 initUsdc = 1000 * 1e6; // 1000 USDC
        uint256 initReserve = 1000 * 1e18; // 1000e18 tokens per side

        usdc.approve(address(core), initUsdc);
        console.log("Approved", initUsdc / 1e6, "USDC to core");

        // Create market
        uint256 marketId = core.createMarket(
            "Will Bitcoin reach $100k by end of 2024?",
            "BTC100K YES",
            "BTC100K-YES",
            "BTC100K NO",
            "BTC100K-NO",
            initReserve,  // initReserveE18
            300,           // feeBps = 3%
            500,           // maxTradeBps = 5%
            initUsdc       // initUsdc
        );

        console.log("Market created with ID:", marketId);
        console.log("Market question:", core.markets(marketId).question);
        console.log("Initial reserves YES/NO:", core.markets(marketId).reserveYes, core.markets(marketId).reserveNo);
        console.log("Initial vault:", core.markets(marketId).usdcVault);
        console.log("Spot price YES (E6):", core.spotPriceYesE6(marketId));
        console.log("Spot price NO (E6):", core.spotPriceNoE6(marketId));

        vm.stopBroadcast();
    }
}

