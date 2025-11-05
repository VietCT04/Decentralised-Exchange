// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract SimpleDex {
    using SafeERC20 for IERC20;

    struct Order {
        address owner;
        address sellToken;
        address buyToken;
        uint256 sellAmount; // initial quote: sellAmount for buyAmount
        uint256 buyAmount;
        uint256 remainingSell; // escrowed in this contract
        bool active;
    }

    Order[] public orders;

    event OrderCreated(
        uint256 indexed id,
        address indexed owner,
        address indexed sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount
    );
    event OrderCancelled(uint256 indexed id, uint256 refunded);

    function createOrder(
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount
    ) external returns (uint256 id) {
        require(sellToken != address(0) && buyToken != address(0), "zero addr");
        require(sellToken != buyToken, "same token");
        require(sellAmount > 0 && buyAmount > 0, "zero amount");

        // escrow seller's tokens
        IERC20(sellToken).safeTransferFrom(
            msg.sender,
            address(this),
            sellAmount
        );

        orders.push(
            Order({
                owner: msg.sender,
                sellToken: sellToken,
                buyToken: buyToken,
                sellAmount: sellAmount,
                buyAmount: buyAmount,
                remainingSell: sellAmount,
                active: true
            })
        );

        id = orders.length - 1;
        emit OrderCreated(
            id,
            msg.sender,
            sellToken,
            buyToken,
            sellAmount,
            buyAmount
        );
    }

    function cancelOrder(uint256 id) external {
        Order storage o = orders[id];
        require(o.active, "inactive");
        require(o.owner == msg.sender, "not owner");

        uint256 refund = o.remainingSell;
        o.active = false;
        o.remainingSell = 0;

        IERC20(o.sellToken).safeTransfer(msg.sender, refund);
        emit OrderCancelled(id, refund);
    }

    // convenience views
    function getOrdersLength() external view returns (uint256) {
        return orders.length;
    }
    function getOrder(uint256 id) external view returns (Order memory) {
        return orders[id];
    }
}
