// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockYieldStrategy {
    mapping(address => uint256) public balances;
    mapping(address => uint256) public depositedAmounts;

    function deposit(uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        IERC20 token = IERC20(msg.sender);
        
        // Transfer tokens from caller
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        // Track deposit
        depositedAmounts[msg.sender] += _amount;
        balances[msg.sender] += _amount;
    }

    function withdraw(uint256 _amount) external {
        require(_amount > 0, "Amount must be > 0");
        require(balances[msg.sender] >= _amount, "Insufficient balance");
        
        IERC20 token = IERC20(msg.sender);
        
        // Subtract from balance first (reentrancy protection)
        balances[msg.sender] -= _amount;
        
        // Transfer tokens back
        require(token.transfer(msg.sender, _amount), "Transfer failed");
    }

    function getBalance(address _user) external view returns (uint256) {
        return balances[_user];
    }
}