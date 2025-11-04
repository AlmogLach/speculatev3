// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "forge-std/console.sol";
import {Treasury} from "src/Treasury.sol";
import {SpeculateCore} from "src/SpeculateCore.sol";

contract DeployTreasury is Script {
    // Update if needed
    address constant CORE = 0xc092d18226e5D2bc737FD4bE97cb6089cB3D4772;
    address constant OWNER = 0xbd0e87A678f3D53a27D1bb186cfc8fd465433554;

    function run() external {
        string memory pk = vm.envString("PRIVATE_KEY");
        bytes memory bs = bytes(pk);
        uint256 key = (bs.length >= 2 && bs[0] == bytes1("0") && bs[1] == bytes1("x"))
            ? vm.parseUint(pk)
            : vm.parseUint(string(abi.encodePacked("0x", pk)));
        vm.startBroadcast(key);

        Treasury treasury = new Treasury(OWNER);
        console.log("Treasury deployed:", address(treasury));

        SpeculateCore core = SpeculateCore(CORE);
        core.setTreasury(address(treasury));
        console.log("Treasury set on core");

        vm.stopBroadcast();
    }
}


