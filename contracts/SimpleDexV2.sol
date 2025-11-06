// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * SimpleDexV2 — auto-matching on order creation.
 * - Orders are escrowed on creation (sellToken pulled into the contract).
 * - When a new order is created, we try to match against the *opposite* book
 *   (sellToken == new.buyToken && buyToken == new.sellToken).
 * - Crossing rule (no floating point):
 *     newPrice = new.buyAmount / new.sellAmount       // B per A
 *     oppBid    = opp.sellAmount / opp.buyAmount      // B per A (because opp is selling B for A)
 *   We match if: newPrice <= oppBid
 *   i.e. taker (new) sells at a price <= best bid -> trade at maker price (= oppBid).
 *
 * Trade amounts:
 *   Let oppRemB = opp.remainingSell (units of opp.sellToken = B)
 *   Max A the opp can buy: maxA = oppRemB * opp.buyAmount / opp.sellAmount
 *   Trade A = min(new.remainingSell, maxA)
 *   Trade B = tradeA * opp.sellAmount / opp.buyAmount
 *
 * NOTE: Uses OpenZeppelin Math.mulDiv for full-precision mul/div (install OZ).
 */

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract SimpleDexV2 {
    using Math for uint256;

    struct Order {
        address owner;
        address sellToken; // the token escrowed by this order
        address buyToken; // the token desired
        uint256 sellAmount; // original sell amount (for reference)
        uint256 buyAmount; // original desired buy amount
        uint256 remainingSell; // remaining sellToken still in escrow
        bool active;
        uint64 createdAt;
    }

    // storage
    Order[] public orders;

    // per pair book (sell->buy). We keep ids; inactive can stay in list.
    mapping(bytes32 => uint256[]) public book;

    // optional: cap how many matches a single create can perform (gas guard)
    uint256 public constant MAX_MATCH_STEPS = 64;

    // events
    event OrderCreated(
        uint256 indexed id,
        address indexed owner,
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount
    );
    event OrderFilled(
        uint256 indexed makerId,
        uint256 indexed takerId,
        address maker,
        address taker,
        uint256 amountSellFromTaker /*A*/,
        uint256 amountBuyFromMaker /*B*/,
        uint256 priceN,
        uint256 priceD
    );
    event OrderCancelled(uint256 indexed id);
    event OrderClosed(uint256 indexed id);

    // --- views ---
    function getOrdersLength() external view returns (uint256) {
        return orders.length;
    }
    function getOrder(uint256 id) external view returns (Order memory) {
        return orders[id];
    }

    // --- utils ---
    function _pairKey(
        address sell,
        address buy
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(sell, buy));
    }

    function _transferIn(address token, address from, uint256 amt) internal {
        require(
            IERC20(token).transferFrom(from, address(this), amt),
            "pull fail"
        );
    }

    function _transferOut(address token, address to, uint256 amt) internal {
        require(IERC20(token).transfer(to, amt), "push fail");
    }

    // price comparison helpers without fractions:
    // newPrice = new.buy / new.sell      vs   oppBid = opp.sell / opp.buy
    // newPrice <= oppBid  <=>  new.buy * opp.buy <= new.sell * opp.sell
    function _crosses(
        uint256 newBuy,
        uint256 newSell,
        uint256 oppSell,
        uint256 oppBuy
    ) internal pure returns (bool) {
        return newBuy * oppBuy <= newSell * oppSell;
    }

    // --- core: create order with auto-match ---
    function createOrder(
        address sellToken,
        address buyToken,
        uint256 sellAmount,
        uint256 buyAmount
    ) external returns (uint256 id) {
        require(sellToken != address(0) && buyToken != address(0), "bad token");
        require(sellToken != buyToken, "identical tokens");
        require(sellAmount > 0 && buyAmount > 0, "bad amount");

        // Pull entire sell amount in escrow first
        _transferIn(sellToken, msg.sender, sellAmount);

        // Create the (yet unstored) taker order in memory
        Order memory taker = Order({
            owner: msg.sender,
            sellToken: sellToken,
            buyToken: buyToken,
            sellAmount: sellAmount,
            buyAmount: buyAmount,
            remainingSell: sellAmount,
            active: true,
            createdAt: uint64(block.timestamp)
        });

        // Try to match against opposite side
        bytes32 oppKey = _pairKey(buyToken, sellToken); // opposite book: selling buyToken for sellToken
        uint256[] storage oppList = book[oppKey];

        uint256 steps = 0;

        for (
            uint256 i = 0;
            i < oppList.length &&
                taker.remainingSell > 0 &&
                steps < MAX_MATCH_STEPS;
            i++
        ) {
            steps++;

            uint256 makerId = oppList[i];
            Order storage maker = orders.length > makerId
                ? orders[makerId]
                : orders[0]; // silence static analyzer
            if (makerId >= orders.length) continue; // defensive
            if (!maker.active) continue; // already inactive
            if (maker.remainingSell == 0) continue; // nothing left
            // maker must be exactly the opposite pair
            if (maker.sellToken != buyToken || maker.buyToken != sellToken)
                continue;

            // Check crossing: takerPrice <= makerBid (trade at maker price)
            bool crosses = _crosses(
                taker.buyAmount,
                taker.sellAmount, // newPrice = buy/sell (B per A)
                maker.sellAmount,
                maker.buyAmount // oppBid  = sell/buy (B per A)
            );

            if (!crosses) continue;

            // Compute max A that maker can buy, given remaining B escrow (maker.remainingSell)
            // maxA = makerRemB * maker.buy / maker.sell   (A units)
            uint256 maxA = Math.mulDiv(
                maker.remainingSell,
                maker.buyAmount,
                maker.sellAmount
            );

            // A traded from taker (A = taker.sellToken)
            uint256 tradeA = taker.remainingSell <= maxA
                ? taker.remainingSell
                : maxA;
            if (tradeA == 0) continue;

            // Corresponding B from maker, at maker price:
            // tradeB = tradeA * maker.sell / maker.buy
            uint256 tradeB = Math.mulDiv(
                tradeA,
                maker.sellAmount,
                maker.buyAmount
            );

            // Move escrowed tokens: from taker escrow (A) to maker, and from maker escrow (B) to taker
            taker.remainingSell -= tradeA;
            maker.remainingSell -= tradeB;

            _transferOut(taker.sellToken, maker.owner, tradeA);
            _transferOut(maker.sellToken, taker.owner, tradeB);

            emit OrderFilled(
                makerId,
                type(uint256).max, // taker not yet stored; report max
                maker.owner,
                taker.owner,
                tradeA,
                tradeB,
                maker.sellAmount,
                maker.buyAmount // report maker price N/D = B/A
            );

            if (maker.remainingSell == 0) {
                maker.active = false;
                emit OrderClosed(makerId);
            }
        }

        // If any remainder from taker, store it as a resting order
        if (taker.remainingSell > 0) {
            id = orders.length;
            orders.push(taker);
            book[_pairKey(sellToken, buyToken)].push(id);
            emit OrderCreated(
                id,
                taker.owner,
                sellToken,
                buyToken,
                sellAmount,
                buyAmount
            );
        } else {
            // fully filled; nothing to store
            return type(uint256).max; // sentinel if you want to detect "no resting order"
        }
    }

    // manual cancel (returns remaining escrow to owner)
    function cancelOrder(uint256 id) external {
        Order storage o = orders[id];
        require(o.active, "inactive");
        require(o.owner == msg.sender, "not owner");
        uint256 rem = o.remainingSell;
        o.remainingSell = 0;
        o.active = false;
        if (rem > 0) _transferOut(o.sellToken, msg.sender, rem);
        emit OrderCancelled(id);
    }
}
