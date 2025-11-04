// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import "../src/MockUSDC.sol";

/**
 * @title SetDirectCoreInUsdc
 * @notice Script to set DirectCore address in existing MockUSDC contract
 */
contract SetDirectCoreInUsdc is Script {
    function run() external {
        string memory pkStr = vm.envString("PRIVATE_KEY");
        bytes memory bs = bytes(pkStr);
        uint256 key = (bs.length >= 2 && bs[0] == bytes1("0") && bs[1] == bytes1("x"))
            ? vm.parseUint(pkStr)
            : vm.parseUint(string(abi.encodePacked("0x", pkStr)));
        
        address usdcAddress = 0xf623e17a1e6aBd8F9C032243385703483586ACeE;
        address directCoreAddress = 0x3a9F3AE06f2D23F76B1882BB5864B64c107FC37E;
        
        MockUSDC usdc = MockUSDC(usdcAddress);
        
        console.log("MockUSDC:", usdcAddress);
        console.log("DirectCore:", directCoreAddress);
        console.log("Current DirectCore in MockUSDC:", usdc.directCore());
        
        vm.startBroadcast(key);
        
        usdc.setDirectCore(directCoreAddress);
        
        console.log("DirectCore address set successfully!");
        console.log("New DirectCore in MockUSDC:", usdc.directCore());
        
        vm.stopBroadcast();
    }
}

