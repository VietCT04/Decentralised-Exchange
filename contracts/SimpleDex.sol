// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(
        address from,
        address to,
        uint256 value
    ) external returns (bool);
    function balanceOf(address) external view returns (uint256);
    function allowance(
        address owner,
        address spender
    ) external view returns (uint256);
    function decimals() external view returns (uint8);
}

contract SimpleDex {
    struct Order {
        address owner;
        address sellToken; // token the maker sells (escrowed in DEX)
        address buyToken; // token the maker wants to receive
        uint256 sellAmount; // total sell amount initially
        uint256 buyAmount; // total buy amount expected
        uint256 remainingSell; // remaining sell amount
        bool active; // false when fully filled or cancelled
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

    event OrderCancelled(uint256 indexed id, address indexed owner);

    event OrderFilled(
        uint256 indexed id,
        address indexed maker,
        address indexed taker,
        uint256 sellTaken, // amount of sellToken moved to taker
        uint256 buyPaid // amount of buyToken paid by taker to maker
    );

    // --- tiny reentrancy guard (enough for this MVP) ---
    uint256 private _locked = 1;
    modifier nonReentrant() {
        require(_locked == 1, "REENTRANCY");
        _locked = 2;
        _;
        _locked = 1;
    }

    // ========== Maker side ==========

    function createOrder(
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount
    ) external nonReentrant returns (uint256 id) {
        require(sellToken != address(0) && buyToken != address(0), "ZERO_ADDR");
        require(sellAmount > 0 && buyAmount > 0, "BAD_AMT");

        // Pull sellToken from maker to DEX (escrow)
        require(
            IERC20(sellToken).transferFrom(
                msg.sender,
                address(this),
                sellAmount
            ),
            "PULL_FAIL"
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

    function cancelOrder(uint256 id) external nonReentrant {
        require(id < orders.length, "NO_ORDER");
        Order storage o = orders[id];
        require(o.active, "INACTIVE");
        require(msg.sender == o.owner, "NOT_OWNER");

        uint256 rem = o.remainingSell;
        o.remainingSell = 0;
        o.active = false;

        if (rem > 0) {
            require(IERC20(o.sellToken).transfer(o.owner, rem), "REFUND_FAIL");
        }
        emit OrderCancelled(id, o.owner);
    }

    // ========== Taker side ==========

    /// @notice Fill an order by taking a portion of maker's sellToken.
    /// @param id Order id.
    /// @param sellAmountToTake Amount of sellToken (from the order) the taker wants.
    ///        Must be <= remainingSell.
    ///        The taker will pay buyToken proportionally:
    ///        buyRequired = ceil( sellAmountToTake * order.buyAmount / order.sellAmount ).
    function fillOrder(
        uint256 id,
        uint256 sellAmountToTake
    ) external nonReentrant {
        require(id < orders.length, "NO_ORDER");
        Order storage o = orders[id];
        require(o.active, "INACTIVE");
        require(
            sellAmountToTake > 0 && sellAmountToTake <= o.remainingSell,
            "BAD_TAKE"
        );

        // price = buyAmount / sellAmount
        // compute taker's buyRequired with rounding up to not underpay
        uint256 buyRequired = (o.buyAmount *
            sellAmountToTake +
            (o.sellAmount - 1)) / o.sellAmount;

        // pull buyToken from taker to maker
        require(
            IERC20(o.buyToken).transferFrom(msg.sender, o.owner, buyRequired),
            "PAY_FAIL"
        );

        // send sellToken (escrowed in DEX) to taker
        require(
            IERC20(o.sellToken).transfer(msg.sender, sellAmountToTake),
            "SEND_FAIL"
        );

        // update remaining / close if zero
        o.remainingSell -= sellAmountToTake;
        if (o.remainingSell == 0) {
            o.active = false;
        }

        emit OrderFilled(
            id,
            o.owner,
            msg.sender,
            sellAmountToTake,
            buyRequired
        );
    }

    // ========== Views ==========

    function getOrdersLength() external view returns (uint256) {
        return orders.length;
    }

    function getOrder(
        uint256 id
    )
        external
        view
        returns (
            address owner,
            address sellToken,
            address buyToken,
            uint256 sellAmount,
            uint256 buyAmount,
            uint256 remainingSell,
            bool active
        )
    {
        require(id < orders.length, "NO_ORDER");
        Order storage o = orders[id];
        return (
            o.owner,
            o.sellToken,
            o.buyToken,
            o.sellAmount,
            o.buyAmount,
            o.remainingSell,
            o.active
        );
    }
}
