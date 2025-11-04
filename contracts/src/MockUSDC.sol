// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MockUSDC is ERC20, Ownable {
    mapping(address => bool) public minters; // Addresses allowed to mint
    address public directCore; // DirectCore contract address

    event MinterAdded(address indexed minter);
    event MinterRemoved(address indexed minter);

    constructor() ERC20("Mock USDC", "mUSDC") Ownable(msg.sender) {
        minters[msg.sender] = true; // Owner is also a minter
    }

    function decimals() public pure override returns (uint8) { return 6; }

    modifier onlyMinter() {
        require(minters[msg.sender] || owner() == msg.sender, "not minter");
        _;
    }

    // Set DirectCore contract address (only owner)
    function setDirectCore(address _directCore) external onlyOwner {
        require(_directCore != address(0), "zero address");
        directCore = _directCore;
    }

    // Add a minter (only owner)
    function addMinter(address minter) external onlyOwner {
        require(minter != address(0), "zero address");
        minters[minter] = true;
        emit MinterAdded(minter);
    }

    // Remove a minter (only owner)
    function removeMinter(address minter) external onlyOwner {
        require(minter != address(0), "zero address");
        minters[minter] = false;
        emit MinterRemoved(minter);
    }

    // Check if caller is admin in DirectCore
    function _isDirectCoreAdmin(address account) internal view returns (bool) {
        if (directCore == address(0)) return false;
        
        // Try to call admin() and admins() on DirectCore
        // DirectCore interface: admin() and admins(address)
        (bool success1, bytes memory data1) = directCore.staticcall(
            abi.encodeWithSignature("admin()")
        );
        if (success1 && data1.length >= 32) {
            address primaryAdmin = abi.decode(data1, (address));
            if (account == primaryAdmin) return true;
        }

        (bool success2, bytes memory data2) = directCore.staticcall(
            abi.encodeWithSignature("admins(address)", account)
        );
        if (success2 && data2.length >= 32) {
            bool isAdmin = abi.decode(data2, (bool));
            if (isAdmin) return true;
        }

        return false;
    }

    // Mint tokens - can be called by owner, minters, or DirectCore admins
    function mint(address to, uint256 amount) external {
        require(
            owner() == msg.sender || 
            minters[msg.sender] || 
            _isDirectCoreAdmin(msg.sender),
            "not authorized"
        );
        _mint(to, amount);
    }

    // Burn tokens - can be called by owner, minters, or DirectCore admins
    function burn(address from, uint256 amount) external {
        require(
            owner() == msg.sender || 
            minters[msg.sender] || 
            _isDirectCoreAdmin(msg.sender),
            "not authorized"
        );
        _burn(from, amount);
    }
}
