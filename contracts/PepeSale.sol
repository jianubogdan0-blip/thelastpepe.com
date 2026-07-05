// contracts/PepeSale.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract PepeSale is ReentrancyGuard {
    address public owner;
    IERC20 public pepe;

    // price[tokenPayment] = amount of paymentToken (in its smallest unit)
    // required to buy 1e18 units of Pepe
    mapping(address => uint256) public pricePer1e18Pepe;

    event BoughtWithETH(address indexed buyer, uint256 pepeAmount, uint256 cost);
    event BoughtWithToken(address indexed buyer, address paymentToken, uint256 pepeAmount, uint256 cost);
    event PriceSet(address indexed token, uint256 price);

    modifier onlyOwner() {
        require(msg.sender == owner, "only owner");
        _;
    }

    constructor(address _pepe) {
        owner = msg.sender;
        pepe = IERC20(_pepe);
    }

    // Set price for paymentToken. For native ETH use address(0).
    // Price format: how many paymentToken smallest-units are needed to buy 1e18 Pepe.
    function setPrice(address paymentToken, uint256 pricePer1e18) external onlyOwner {
        pricePer1e18Pepe[paymentToken] = pricePer1e18;
        emit PriceSet(paymentToken, pricePer1e18);
    }

    // Buy pepeAmount (in Pepe smallest units) paying with native ETH.
    function buyWithETH(uint256 pepeAmount) external payable nonReentrant {
        uint256 price = pricePer1e18Pepe[address(0)];
        require(price > 0, "price not set for ETH");
        uint256 cost = (pepeAmount * price) / 1e18;
        require(msg.value >= cost, "insufficient ETH sent");

        // forward cost to owner
        (bool sent, ) = owner.call{value: cost}("");
        require(sent, "transfer to owner failed");

        // refund extra
        if (msg.value > cost) {
            (bool refunded, ) = msg.sender.call{value: msg.value - cost}("");
            require(refunded, "refund failed");
        }

        require(pepe.transfer(msg.sender, pepeAmount), "pepe transfer failed");

        emit BoughtWithETH(msg.sender, pepeAmount, cost);
    }

    // Buy using an ERC20 payment token. Buyer must approve this contract first.
    function buyWithERC20(address paymentToken, uint256 pepeAmount) external nonReentrant {
        uint256 price = pricePer1e18Pepe[paymentToken];
        require(price > 0, "price not set for token");
        uint256 cost = (pepeAmount * price) / 1e18;

        IERC20 pay = IERC20(paymentToken);
        require(pay.transferFrom(msg.sender, owner, cost), "payment transfer failed");

        require(pepe.transfer(msg.sender, pepeAmount), "pepe transfer failed");

        emit BoughtWithToken(msg.sender, paymentToken, pepeAmount, cost);
    }

    // Owner can withdraw any tokens accidentally left in the contract
    function withdrawToken(address token, uint256 amount) external onlyOwner {
        IERC20(token).transfer(owner, amount);
    }

    // Owner can withdraw native ETH
    function withdrawETH(uint256 amount) external onlyOwner {
        (bool s,) = owner.call{value: amount}("");
        require(s, "withdraw eth failed");
    }
}
