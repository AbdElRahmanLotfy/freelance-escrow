// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMintable {
    function mint(
        address to,
        uint256 amount
    ) external returns (bool);

    function burn(
        address from,
        uint256 amount
    ) external returns (bool);
}

contract MockAavePool {
    IERC20 public immutable asset;
    IERC20 public immutable aToken;

    constructor(
        address _asset,
        address _aToken
    ) {
        asset = IERC20(_asset);
        aToken = IERC20(_aToken);
    }

    // =============================================================
    //                         AAVE SUPPLY
    // =============================================================

    function supply(
        address _asset,
        uint256 _amount,
        address _onBehalfOf,
        uint16 /* referralCode */
    )
        external
    {
        require(
            _asset == address(asset),
            "Invalid asset"
        );

        require(
            asset.transferFrom(
                msg.sender,
                address(this),
                _amount
            ),
            "Transfer failed"
        );

        /*
         * Real Aave mints aTokens to onBehalfOf.
         */
        require(
            IMintable(address(aToken)).mint(
                _onBehalfOf,
                _amount
            ),
            "Mint failed"
        );
    }

    // =============================================================
    //                        AAVE WITHDRAW
    // =============================================================

    function withdraw(
        address _asset,
        uint256 _amount,
        address _to
    )
        external
        returns (uint256)
    {
        require(
            _asset == address(asset),
            "Invalid asset"
        );

        /*
         * Burn the caller's aTokens.
         */
        require(
            IMintable(address(aToken)).burn(
                msg.sender,
                _amount
            ),
            "Burn failed"
        );

        /*
         * Return the underlying USDC.
         */
        require(
            asset.transfer(
                _to,
                _amount
            ),
            "Transfer failed"
        );

        return _amount;
    }

    // =============================================================
    //                      SIMULATE YIELD
    // =============================================================

   function simulateYield(
    address beneficiary,
    uint256 amount
) external {
    require(amount > 0, "Yield must be > 0");

    require(
        IMintable(address(asset)).mint(address(this), amount),
        "Asset mint failed"
    );

    require(
        IMintable(address(aToken)).mint(beneficiary, amount),
        "aToken mint failed"
    );
}
    // =============================================================
    //                    RESERVE DATA
    // =============================================================

    function getReserveData(
        address _asset
    )
        external
        view
        returns (
            uint256 configuration,
            uint128 liquidityIndex,
            uint128 currentLiquidityRate,
            uint128 variableBorrowIndex,
            uint128 currentVariableBorrowRate,
            uint40 lastUpdateTimestamp,
            uint16 id,
            address aTokenAddress,
            address stableDebtTokenAddress,
            address variableDebtTokenAddress,
            address interestRateStrategyAddress
        )
    {
        require(
            _asset == address(asset),
            "Invalid asset"
        );

        return (
            0,
            1e27,
            0,
            1e27,
            0,
            uint40(block.timestamp),
            0,
            address(aToken),
            address(0),
            address(0),
            address(0)
        );
    }
}