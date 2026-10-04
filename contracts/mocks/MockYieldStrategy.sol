// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title MockYieldStrategy
 * @notice Simulates Aave V3 Pool for local testing
 * @dev Implements the subset of Aave V3 Pool functions used by EscrowWithYield
 */
contract MockYieldStrategy {
    // Track deposits per user
    mapping(address => uint256) public balances;

    /**
     * @notice Simulates Aave V3 supply(asset, amount, onBehalfOf, referralCode)
     */
    function supply(
        address asset,
        uint256 amount,
        address onBehalfOf,
        uint16 /* referralCode */
    ) external {
        require(amount > 0, "Amount must be > 0");
        require(asset != address(0), "Invalid asset");
        require(onBehalfOf != address(0), "Invalid onBehalfOf");

        // Transfer tokens from caller to this mock
        IERC20 token = IERC20(asset);
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        // Credit the onBehalfOf account
        balances[onBehalfOf] += amount;
    }

    /**
     * @notice Simulates Aave V3 withdraw(asset, amount, to)
     * @dev If amount == type(uint256).max, withdraw full balance
     */
    function withdraw(
        address asset,
        uint256 amount,
        address to
    ) external returns (uint256) {
        require(asset != address(0), "Invalid asset");
        require(to != address(0), "Invalid recipient");

        uint256 balance = balances[msg.sender];
        require(balance > 0, "No balance");

        uint256 withdrawAmount = amount;
        if (amount == type(uint256).max) {
            withdrawAmount = balance;
        } else {
            require(amount <= balance, "Insufficient balance");
        }

        // Debit caller
        balances[msg.sender] = balance - withdrawAmount;

        // Transfer tokens to recipient
        IERC20 token = IERC20(asset);
        require(token.transfer(to, withdrawAmount), "Transfer failed");

        return withdrawAmount;
    }

    /**
     * @notice View helper for tests
     */
    function getBalance(address _user) external view returns (uint256) {
        return balances[_user];
    }
}