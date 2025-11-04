// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Treasury is Ownable {
    event Withdraw(address indexed token, address indexed to, uint256 amount);

    constructor(address owner_) Ownable(owner_) {}

    function withdraw(address token, address to, uint256 amount) external onlyOwner {
        require(IERC20(token).transfer(to, amount), "xfer");
        emit Withdraw(token, to, amount);
    }
}


