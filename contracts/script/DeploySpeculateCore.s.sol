// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SpeculateCore} from "../src/SpeculateCore.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {PositionToken} from "../src/PositionToken.sol";

contract DeploySpeculateCore is Script {
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

        // Get the deployer address from the private key
        address deployer = vm.addr(deployerPrivateKey);
        console.log("Deployer address:", deployer);

        // Deploy MockUSDC first
        MockUSDC usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // Deploy SpeculateCore (treasury can be the deployer address for now)
        address treasury = deployer;
        SpeculateCore core = new SpeculateCore(address(usdc), treasury);
        console.log("SpeculateCore deployed at:", address(core));
        console.log("Treasury address:", treasury);

        // Grant market creator role to deployer (already granted in constructor, but we can verify)
        console.log("Deployer has MARKET_CREATOR_ROLE:", core.hasRole(core.MARKET_CREATOR_ROLE(), deployer));
        console.log("Deployer has DEFAULT_ADMIN_ROLE:", core.hasRole(core.DEFAULT_ADMIN_ROLE(), deployer));

        // Set SpeculateCore address on MockUSDC so admins can mint
        usdc.setSpeculateCore(address(core));
        console.log("Set SpeculateCore address on MockUSDC");

        // Mint some USDC to deployer for testing
        uint256 testAmount = 10000 * 1e6; // 10,000 USDC
        usdc.mint(deployer, testAmount);
        console.log("Minted", testAmount / 1e6, "USDC to deployer");
        console.log("Deployer USDC balance:", usdc.balanceOf(deployer) / 1e6);

        // Optional: Create a test market automatically
        // Approve USDC for market creation
        uint256 initUsdc = 1000 * 1e6; // 1000 USDC
        uint256 initReserveE18 = 1000 * 1e18; // 1000e18 tokens per side
        uint16 feeBps = 300; // 3%
        uint16 maxTradeBps = 500; // 5%

        // Approve USDC from deployer (broadcast is already from deployer)
        usdc.approve(address(core), initUsdc);
        console.log("Approved", initUsdc / 1e6, "USDC to core");

        // Create test market (with manual resolution for now)
        uint256 expiryTimestamp = block.timestamp + 30 days; // 30 days from now
        uint256 marketId = core.createMarket(
            "Will BTC be above $100,000 by Dec 31, 2025?",
            "BTC100K YES",
            "BTC100K-YES",
            "BTC100K NO",
            "BTC100K-NO",
            initReserveE18,
            feeBps,
            maxTradeBps,
            initUsdc,
            expiryTimestamp,
            SpeculateCore.OracleType.None, // Manual resolution for test
            address(0), // No oracle address
            bytes32(0), // No price feed ID
            0, // No target value
            SpeculateCore.Comparison.Above // Not used for manual resolution
        );

        console.log("Test market created with ID:", marketId);
        
        // Access market fields via the mapping getter
        (PositionToken yesToken, PositionToken noToken, uint256 reserveYes, uint256 reserveNo, uint256 marketVault, uint256 marketPairs, uint16 feeTreasuryBps, uint16 feeVaultBps, uint16 feeLpBps, uint16 marketMaxTradeBps, SpeculateCore.MarketStatus status, bool exists, bool sellFees, string memory question, address lp) = core.markets(marketId);
        
        console.log("Market question:", question);
        console.log("Initial reserves YES/NO:", reserveYes, reserveNo);
        console.log("Initial vault:", marketVault);
        console.log("Spot price YES (E6):", core.spotPriceYesE6(marketId));
        console.log("Spot price NO (E6):", core.spotPriceNoE6(marketId));

        vm.stopBroadcast();
    }
}

