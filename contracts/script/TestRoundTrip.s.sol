// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";

import {MockUSDC} from "src/MockUSDC.sol";
import {SpeculateCore} from "src/SpeculateCore.sol";
import {PositionToken} from "src/PositionToken.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TestRoundTrip is Script {
    // Set these to the latest deployed addresses
    address constant CORE = 0x48E27d9689B1ed08b2B090621563472aC84F6D72;
    address constant USDC = 0x8DA6611A1186Ac00E81c9565d07F7749c412BCe7;
    address constant TREASURY = 0xcAe9306e82f8D449a3a15722aadE1F974EE80589;
    address constant ADMIN = 0xbd0e87A678f3D53a27D1bb186cfc8fd465433554;

    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        bytes memory bs = bytes(pkStr);
        uint256 key = (bs.length >= 2 && bs[0] == bytes1("0") && bs[1] == bytes1("x"))
            ? vm.parseUint(pkStr)
            : vm.parseUint(string(abi.encodePacked("0x", pkStr)));
        vm.startBroadcast(key);

        MockUSDC usdc = MockUSDC(USDC);
        SpeculateCore core = SpeculateCore(CORE);

        // Set treasury on new core
        core.setTreasury(TREASURY);

        // Mint USDC to admin for testing
        uint256 mintAmt = 1_000_000 * 1e6; // 1,000,000 USDC
        usdc.mint(ADMIN, mintAmt);
        console.log("USDC minted to admin:", mintAmt);

        // Approve core for initial liquidity and trades
        usdc.approve(CORE, type(uint256).max);
        console.log("USDC approved for core");

        // Create market (1000 USDC initial liquidity)
        uint256 initial = 1_000 * 1e6;
        uint256 expiry = block.timestamp + 30 days;
        uint16 feeBps = 100; // 1%
        uint256 id = core.createMarket(USDC, initial, "Round-trip CPMM test", expiry, feeBps);
        console.log("Market created id:", id);

        // Read tokens
        MockUSDC usdc0;
        PositionToken yes;
        PositionToken no;
        uint256 rY;
        uint256 rN;
        uint256 k0;
        uint256 vY0;
        uint256 vN0;
        uint256 usdcVault;
        uint256 totalPairs;
        uint256 feeUSDC0;
        string memory question0;
        uint256 expiry0;
        address creator0;
        uint16 feeBps0;
        SpeculateCore.Status status0;
        bool yesWins0;
        (usdc0, yes, no, rY, rN, k0, vY0, vN0, usdcVault, totalPairs, feeUSDC0, question0, expiry0, creator0, feeBps0, status0, yesWins0) = core.markets(id);
        console.log("Initial reserves yes/no:", rY, rN);
        console.log("Initial vault/pairs:", usdcVault, totalPairs);

        // Buy 100 NO, then 100 YES
        uint256 buyAmt = 100 * 1e6;
        uint256 out1 = core.buy(id, false, buyAmt);
        console.log("Bought NO tokens:", out1);
        uint256 out2 = core.buy(id, true, buyAmt);
        console.log("Bought YES tokens:", out2);

        // Approve position tokens for selling
        PositionToken(yes).approve(CORE, type(uint256).max);
        PositionToken(no).approve(CORE, type(uint256).max);

        // Sell all bought tokens
        core.sell(id, false, out1);
        core.sell(id, true, out2);
        console.log("Sold both positions");

        // Read vault/pairs and prices
        MockUSDC usdc1;
        PositionToken yes1;
        PositionToken no1;
        uint256 rY2;
        uint256 rN2;
        uint256 k1;
        uint256 vY1;
        uint256 vN1;
        uint256 usdcVault2;
        uint256 totalPairs2;
        uint256 feeUSDC1;
        string memory question1;
        uint256 expiry1;
        address creator1;
        uint16 feeBps1;
        SpeculateCore.Status status1;
        bool yesWins1;
        (usdc1, yes1, no1, rY2, rN2, k1, vY1, vN1, usdcVault2, totalPairs2, feeUSDC1, question1, expiry1, creator1, feeBps1, status1, yesWins1) = core.markets(id);
        console.log("Post round-trip reserves yes/no:", rY2, rN2);
        console.log("Post round-trip vault/pairs:", usdcVault2, totalPairs2);

        uint256 pY = core.priceYesE18(id);
        uint256 pN = core.priceNoE18(id);
        console.log("Prices yes/no (1e18):", pY, pN);

        vm.stopBroadcast();
    }
}


