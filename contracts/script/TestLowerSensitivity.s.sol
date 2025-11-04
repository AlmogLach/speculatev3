// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockUSDC.sol";
import "../src/DirectCore.sol";
import "../src/PositionToken.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract TestLowerSensitivity is Script {
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

        console.log("=== TESTING WITH LOWER SENSITIVITY ===");

        MockUSDC usdc = new MockUSDC();
        DirectCore directCore = new DirectCore();
        console.log("USDC:", address(usdc));
        console.log("DirectCore:", address(directCore));

        // Set lower sensitivity (0.005 = 0.5% instead of 1%)
        directCore.setSensitivity(5e15); // 0.005 = 0.5%
        console.log("Sensitivity set to:", directCore.sensitivityE18());

        usdc.mint(ADMIN, 10_000_000 * ONE_E6);
        usdc.approve(address(directCore), type(uint256).max);

        uint256 marketId = directCore.createMarket(
            address(usdc),
            "Low Sensitivity Test",
            block.timestamp + 30 days,
            300, // 3% fee
            5e17 // 0.5 initial price
        );

        (MockUSDC mUsdc, PositionToken yesToken, PositionToken noToken,,,,,,,,,) = directCore.markets(marketId);
        IERC20(address(yesToken)).approve(address(directCore), type(uint256).max);
        IERC20(address(noToken)).approve(address(directCore), type(uint256).max);

        // Buy YES 100 USD
        console.log("\n=== BUY YES 100 USD ===");
        uint256 yesTokens = directCore.buy(marketId, true, 100 * ONE_E6);
        console.log("YES tokens:", yesTokens);
        _logVault(marketId, directCore);

        // Buy NO 50 USD
        console.log("\n=== BUY NO 50 USD ===");
        uint256 noTokens1 = directCore.buy(marketId, false, 50 * ONE_E6);
        console.log("NO tokens:", noTokens1);
        _logVault(marketId, directCore);

        // Buy NO 50 USD again
        console.log("\n=== BUY NO 50 USD AGAIN ===");
        uint256 noTokens2 = directCore.buy(marketId, false, 50 * ONE_E6);
        uint256 totalNoTokens = noTokens1 + noTokens2;
        console.log("Total NO tokens:", totalNoTokens);
        _logVault(marketId, directCore);

        // Sell ALL YES
        console.log("\n=== SELL ALL YES ===");
        uint256 yesBal = IERC20(address(yesToken)).balanceOf(ADMIN);
        uint256 grossYes = directCore.sell(marketId, true, yesBal);
        console.log("Gross USDC:", grossYes / ONE_E6);
        _logVault(marketId, directCore);

        // Sell ALL NO
        console.log("\n=== SELL ALL NO ===");
        uint256 noBal = IERC20(address(noToken)).balanceOf(ADMIN);
        uint256 grossNo = directCore.sell(marketId, false, noBal);
        console.log("Gross USDC:", grossNo / ONE_E6);
        _logVault(marketId, directCore);

        console.log("\n=== FINAL ===");
        _logVault(marketId, directCore);
        console.log("User USDC:", usdc.balanceOf(ADMIN) / ONE_E6);

        vm.stopBroadcast();
    }

    function _logVault(uint256 id, DirectCore core) internal view {
        (,,,,uint256 vault,uint16 feeBps,uint256 priceYesE18,uint256 feeUSDC,,,,) = core.markets(id);
        console.log("  Vault:", vault / ONE_E6);
        console.log("  Fees:", feeUSDC / ONE_E6);
        console.log("  Price YES:", priceYesE18);
    }
}

