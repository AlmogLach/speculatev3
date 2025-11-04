// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {DirectCore} from "../src/DirectCore.sol";
import {PositionToken} from "../src/PositionToken.sol";

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract TestDirect is Script {
    function _min(uint256 a, uint256 b) internal pure returns (uint256) { return a < b ? a : b; }
    function _calcSellCapTokensE18(uint256 vaultUsdc6, uint256 priceE18, uint16 feeBps) internal pure returns (uint256) {
        if (priceE18 == 0) return 0;
        uint256 oneMinusFee = 10000 - feeBps; // in bps
        // tokensE18 <= (vault * 1e30 * 10000) / (priceE18 * (10000 - feeBps))
        // Explanation: grossUSDC6 = tokensE18 * priceE18 / 1e30, net = gross * (1 - fee)
        // => tokens <= vault / (price * (1 - fee)) with scale factors applied
        uint256 numerator = vaultUsdc6 * 1e30 * 10000;
        uint256 denom = priceE18 * oneMinusFee;
        return denom == 0 ? 0 : numerator / denom;
    }

    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        bytes memory bs = bytes(pkStr);
        uint256 key = (bs.length >= 2 && bs[0] == bytes1("0") && bs[1] == bytes1("x"))
            ? vm.parseUint(pkStr)
            : vm.parseUint(string(abi.encodePacked("0x", pkStr)));
        vm.startBroadcast(key);

        // Deploy USDC and Core
        MockUSDC usdc = new MockUSDC();
        console.log("USDC:", address(usdc));
        DirectCore core = new DirectCore();
        console.log("DirectCore:", address(core));

        // Treasury not required for test, optional
        // core.setTreasury(<treasury>);

        // Mint USDC to admin wallet
        address ADMIN = 0xbd0e87A678f3D53a27D1bb186cfc8fd465433554;
        usdc.mint(ADMIN, 1_000_000 * 1e6);
        console.log("Minted USDC to ADMIN:", usdc.balanceOf(ADMIN));

        // Create market @ p=0.5, fee=1%
        uint16 feeBps = 100;
        uint256 marketId = core.createMarket(
            address(usdc),
            "Direct pricing test",
            block.timestamp + 30 days,
            feeBps,
            5e17
        );
        console.log("Market id:", marketId);

        // Approve core for spending (from ADMIN EOA)
        IERC20(address(usdc)).approve(address(core), type(uint256).max);
        console.log("USDC approved");

        // Buy sequence
        uint256 buy1 = 100 * 1e6; // 100 USDC
        uint256 outNo1 = core.buy(marketId, false, buy1);
        console.log("Buy NO 100 USDC -> tokens:", outNo1);
        uint256 pY1 = core.priceYesE18(marketId);
        uint256 pN1 = core.priceNoE18(marketId);
        (
            MockUSDC mUsdcA,
            PositionToken yesA,
            PositionToken noA,
            uint256 vaultA,
            uint16 feeA,
            uint256 pYA,
            uint256 feesA,
            string memory qA,
            uint256 expA,
            address crA,
            DirectCore.Status stA,
            bool yWA
        ) = core.markets(marketId);
        console.log("After NO buy - Prices (YES/NO):", pY1, pN1);
        console.log("After NO buy - Vault/Fees:", vaultA, feesA);

        uint256 outYes1 = core.buy(marketId, true, buy1);
        console.log("Buy YES 100 USDC -> tokens:", outYes1);
        uint256 pY2 = core.priceYesE18(marketId);
        uint256 pN2 = core.priceNoE18(marketId);
        (
            mUsdcA,
            yesA,
            noA,
            vaultA,
            feeA,
            pYA,
            feesA,
            qA,
            expA,
            crA,
            stA,
            yWA
        ) = core.markets(marketId);
        console.log("After YES buy - Prices (YES/NO):", pY2, pN2);
        console.log("After YES buy - Vault/Fees:", vaultA, feesA);

        // Fetch token addresses from public markets mapping
        (
            MockUSDC mUsdc,
            PositionToken yesToken,
            PositionToken noToken,
            uint256 usdcVault,
            uint16 feeBpsOut,
            uint256 priceYesE18,
            uint256 feeUSDC,
            string memory question,
            uint256 expiry,
            address creator,
            DirectCore.Status status,
            bool yesWins
        ) = core.markets(marketId);
        console.log("Tokens YES/NO:", address(yesToken), address(noToken));

        // Approve YES and NO tokens to core
        IERC20(address(yesToken)).approve(address(core), type(uint256).max);
        IERC20(address(noToken)).approve(address(core), type(uint256).max);
        console.log("Approved YES/NO to core");

        // Sell NO safely (cap by vault)
        uint256 capNo = _calcSellCapTokensE18(usdcVault, 1e18 - priceYesE18, feeBpsOut);
        uint256 sellNoAmt = _min(outNo1, capNo);
        uint256 usdcOutNo = core.sell(marketId, false, sellNoAmt);
        console.log("Sell NO tokens -> gross USDC:", usdcOutNo);
        (
            mUsdc,
            yesToken,
            noToken,
            usdcVault,
            feeBpsOut,
            priceYesE18,
            feeUSDC,
            question,
            expiry,
            creator,
            status,
            yesWins
        ) = core.markets(marketId);
        uint256 pY3 = core.priceYesE18(marketId);
        uint256 pN3 = core.priceNoE18(marketId);
        console.log("After NO sell - Prices (YES/NO):", pY3, pN3);
        console.log("After NO sell - Vault/Fees:", usdcVault, feeUSDC);

        // Sell YES safely (cap by vault)
        uint256 capYes = _calcSellCapTokensE18(usdcVault, priceYesE18, feeBpsOut);
        uint256 sellYesAmt = _min(outYes1, capYes);
        uint256 usdcOutYes = core.sell(marketId, true, sellYesAmt);
        console.log("Sell YES tokens -> gross USDC:", usdcOutYes);
        (
            mUsdc,
            yesToken,
            noToken,
            usdcVault,
            feeBpsOut,
            priceYesE18,
            feeUSDC,
            question,
            expiry,
            creator,
            status,
            yesWins
        ) = core.markets(marketId);
        uint256 pY4 = core.priceYesE18(marketId);
        uint256 pN4 = core.priceNoE18(marketId);
        console.log("After YES sell - Prices (YES/NO):", pY4, pN4);
        console.log("After YES sell - Vault/Fees:", usdcVault, feeUSDC);

        vm.stopBroadcast();
    }
}


