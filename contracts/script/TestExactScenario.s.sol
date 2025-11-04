// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockUSDC.sol";
import "../src/DirectCore.sol";
import "../src/PositionToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestExactScenario is Script {
    address public ADMIN;
    uint256 private constant ONE_E18 = 1e18;
    uint256 private constant ONE_E6 = 1e6;

    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        bytes memory bs = bytes(pkStr);
        uint256 key = (bs.length >= 2 && bs[0] == bytes1("0") && bs[1] == bytes1("x"))
            ? vm.parseUint(pkStr)
            : vm.parseUint(string(abi.encodePacked("0x", pkStr)));
        ADMIN = vm.addr(key);
        vm.startBroadcast(key);

        console.log("=== TESTING EXACT USER SCENARIO ===");
        console.log("Admin:", ADMIN);

        // Deploy contracts
        MockUSDC usdc = new MockUSDC();
        DirectCore directCore = new DirectCore();
        console.log("USDC:", address(usdc));
        console.log("DirectCore:", address(directCore));

        // Mint USDC
        usdc.mint(ADMIN, 10_000_000 * ONE_E6);
        console.log("Minted USDC:", usdc.balanceOf(ADMIN) / ONE_E6);

        // Approve
        usdc.approve(address(directCore), type(uint256).max);

        // Create market with 3% fee
        uint256 marketId = directCore.createMarket(
            address(usdc),
            "Test Scenario",
            block.timestamp + 30 days,
            300, // 3% fee
            5e17 // 0.5 initial price
        );
        console.log("\nMarket created, ID:", marketId);

        // Get token addresses
        (MockUSDC mUsdc, PositionToken yesToken, PositionToken noToken,,,,,,,,,) = directCore.markets(marketId);
        console.log("YES Token:", address(yesToken));
        console.log("NO Token:", address(noToken));

        // Approve tokens for selling
        IERC20(address(yesToken)).approve(address(directCore), type(uint256).max);
        IERC20(address(noToken)).approve(address(directCore), type(uint256).max);

        // --- BUY YES 100 USD ---
        console.log("\n=== BUY YES 100 USD ===");
        uint256 buyYes1 = 100 * ONE_E6;
        uint256 yesTokens1 = directCore.buy(marketId, true, buyYes1);
        console.log("Received YES tokens:", yesTokens1);
        _logState(marketId, directCore, usdc, yesToken, noToken);

        // --- BUY NO 50 USD ---
        console.log("\n=== BUY NO 50 USD ===");
        uint256 buyNo1 = 50 * ONE_E6;
        uint256 noTokens1 = directCore.buy(marketId, false, buyNo1);
        console.log("Received NO tokens:", noTokens1);
        _logState(marketId, directCore, usdc, yesToken, noToken);

        // --- BUY NO 50 USD AGAIN ---
        console.log("\n=== BUY NO 50 USD AGAIN ===");
        uint256 buyNo2 = 50 * ONE_E6;
        uint256 noTokens2 = directCore.buy(marketId, false, buyNo2);
        console.log("Received NO tokens:", noTokens2);
        uint256 totalNoTokens = noTokens1 + noTokens2;
        console.log("Total NO tokens:", totalNoTokens);
        _logState(marketId, directCore, usdc, yesToken, noToken);

        // --- SELL ALL YES ---
        console.log("\n=== SELL ALL YES TOKENS ===");
        uint256 yesBalance = IERC20(address(yesToken)).balanceOf(ADMIN);
        console.log("Selling YES tokens:", yesBalance);
        uint256 grossYesUsdc = directCore.sell(marketId, true, yesBalance);
        console.log("Gross USDC received:", grossYesUsdc / ONE_E6);
        _logState(marketId, directCore, usdc, yesToken, noToken);

        // --- SELL ALL NO ---
        console.log("\n=== SELL ALL NO TOKENS ===");
        uint256 noBalance = IERC20(address(noToken)).balanceOf(ADMIN);
        console.log("Selling NO tokens:", noBalance);
        uint256 grossNoUsdc = directCore.sell(marketId, false, noBalance);
        console.log("Gross USDC received:", grossNoUsdc / ONE_E6);
        _logState(marketId, directCore, usdc, yesToken, noToken);

        // --- FINAL SUMMARY ---
        console.log("\n=== FINAL SUMMARY ===");
        uint256 totalSpent = buyYes1 + buyNo1 + buyNo2;
        uint256 grossReceived = grossYesUsdc + grossNoUsdc;
        uint256 sellFees = (grossYesUsdc * 300) / 10000 + (grossNoUsdc * 300) / 10000;
        uint256 netReceived = grossReceived - sellFees;
        uint256 buyFees = (buyYes1 * 300) / 10000 + (buyNo1 * 300) / 10000 + (buyNo2 * 300) / 10000;
        uint256 totalFees = buyFees + sellFees;

        console.log("Total spent:", totalSpent / ONE_E6);
        console.log("Gross received:", grossReceived / ONE_E6);
        console.log("Net received:", netReceived / ONE_E6);
        console.log("Total fees:", totalFees / ONE_E6);
        console.log("Net loss:", (totalSpent - netReceived) / ONE_E6);

        _logState(marketId, directCore, usdc, yesToken, noToken);

        vm.stopBroadcast();
    }

    function _logState(uint256 id, DirectCore core, MockUSDC usdc, PositionToken yesToken, PositionToken noToken) internal view {
        (MockUSDC mUsdc, PositionToken yt, PositionToken nt, uint256 vault, uint16 feeBps, uint256 priceYesE18, uint256 feeUSDC, string memory question, uint256 expiry, address creator, DirectCore.Status status, bool yesWins) = core.markets(id);
        console.log("  Vault:", vault / ONE_E6);
        console.log("  Accumulated Fees:", feeUSDC / ONE_E6);
        console.log("  Price YES:", priceYesE18);
        console.log("  User USDC:", usdc.balanceOf(ADMIN) / ONE_E6);
        console.log("  User YES:", IERC20(address(yesToken)).balanceOf(ADMIN));
        console.log("  User NO:", IERC20(address(noToken)).balanceOf(ADMIN));
    }
}

