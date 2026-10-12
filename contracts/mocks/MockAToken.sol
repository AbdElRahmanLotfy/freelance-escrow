// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockAToken is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(
        string memory name_,
        string memory symbol_,
        uint8 decimals_
    )
        ERC20(name_, symbol_)
    {
        _tokenDecimals = decimals_;
    }

    function decimals()
        public
        view
        override
        returns (uint8)
    {
        return _tokenDecimals;
    }

    /**
     * Mock Aave scaled balance.
     *
     * In real Aave, scaledBalanceOf() is the principal
     * representation before applying the liquidity index.
     *
     * For this simple mock:
     *
     * scaled balance == normal balance
     */
    function scaledBalanceOf(
        address account
    )
        external
        view
        returns (uint256)
    {
        return balanceOf(account);
    }

    function mint(
        address to,
        uint256 amount
    )
        external
        returns (bool)
    {
        _mint(to, amount);
        return true;
    }

    function burn(
        address from,
        uint256 amount
    )
        external
        returns (bool)
    {
        _burn(from, amount);
        return true;
    }
}