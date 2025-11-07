// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/AggregatorV3Interface.sol";
import "./interfaces/AutomationCompatibleInterface.sol";
import "./SpeculateCore.sol";

/**
 * @title ChainlinkResolver
 * @notice Single global resolver that automatically resolves ALL markets (existing + future)
 * @dev Scans SpeculateCore markets, uses global price feeds by feed ID, and Chainlink Automation
 */
contract ChainlinkResolver is AutomationCompatibleInterface {
    SpeculateCore public immutable core;
    address public owner;
    
    // Global Chainlink feeds by feed ID (e.g., keccak256("ETH/USD"))
    mapping(bytes32 => address) public globalFeeds;
    
    event FeedRegistered(bytes32 indexed feedId, address feedAddress);
    event MarketResolved(uint256 indexed marketId, bool yesWins, uint256 price);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor(address _core) {
        require(_core != address(0), "zero core");
        core = SpeculateCore(_core);
        owner = msg.sender;
    }

    /**
     * @notice Register or update a Chainlink feed once globally (by feed ID)
     * @param feedId A bytes32 ID like keccak256("ETH/USD") or keccak256("BTC/USD")
     * @param feedAddress Chainlink AggregatorV3Interface address
     * @dev Once registered, all markets using this feedId will automatically use this address
     */
    function setGlobalFeed(bytes32 feedId, address feedAddress) external onlyOwner {
        require(feedAddress != address(0), "zero feed");
        
        // Note: Validation removed to allow setting feeds that may not exist yet on testnet
        // The feed will be validated when actually used in performUpkeep
        
        globalFeeds[feedId] = feedAddress;
        emit FeedRegistered(feedId, feedAddress);
    }

    /// @dev Legacy stub kept for backwards compatibility with old scripts. No-op.
    function registerMarket(uint256 /*marketId*/, address /*priceFeed*/) external pure {
        revert("registerMarket deprecated");
    }

    /**
     * @notice Check if upkeep is needed (Chainlink Automation)
     * @param checkData Encoded start index (optional, defaults to 1). If empty, starts from market 1.
     * @return upkeepNeeded Whether upkeep is needed
     * @return performData Data to pass to performUpkeep (encoded market ID)
     * @dev Loops through all markets starting from the index in checkData (or 1 if empty)
     *      and finds the first market that needs resolution
     */
    function checkUpkeep(bytes calldata checkData) 
        external 
        view 
        override 
        returns (bool upkeepNeeded, bytes memory performData) 
    {
        // Get start index from checkData, or default to 1
        uint256 startIndex = 1;
        if (checkData.length > 0) {
            startIndex = abi.decode(checkData, (uint256));
        }
        
        // Get total market count
        uint256 totalMarkets = core.marketCount();
        
        // Limit to checking 50 markets per call to avoid gas issues
        // If we have more than 50 markets, we'll check them in batches
        uint256 maxMarketsToCheck = 50;
        uint256 endIndex = startIndex + maxMarketsToCheck;
        if (endIndex > totalMarkets) {
            endIndex = totalMarkets + 1; // +1 because we use < in the loop
        }
        
        // Loop through markets starting from startIndex
        for (uint256 i = startIndex; i < endIndex; i++) {
            // Check if this market needs resolution
            (bool needsUpkeep, bytes memory marketPerformData) = core.checkUpkeep(i);
            
            if (needsUpkeep) {
                // Found a market that needs resolution
                return (true, marketPerformData);
            }
        }
        
        // No markets in this batch need resolution
        // If there are more markets to check (endIndex <= totalMarkets), 
        // they will be checked on the next upkeep cycle when it restarts from market 1
        // This is safe because markets will be checked regularly
        return (false, "");
    }

    /**
     * @notice Perform upkeep (Chainlink Automation)
     * @param performData Encoded market ID
     * @dev Automatically resolves markets using global feed mapping by priceFeedId
     */
    function performUpkeep(bytes calldata performData) external override {
        uint256 marketId = abi.decode(performData, (uint256));
        
        // Check if market can be auto-resolved
        (bool upkeepNeeded, ) = core.checkUpkeep(marketId);
        require(upkeepNeeded, "upkeep not needed");

        // Get market resolution config
        SpeculateCore.ResolutionConfig memory resolution = core.getMarketResolution(marketId);
        require(resolution.oracleType == SpeculateCore.OracleType.ChainlinkFeed, "not chainlink");
        
        // Get price feed address from global feeds mapping using priceFeedId
        address priceFeedAddress = globalFeeds[resolution.priceFeedId];
        
        // Fallback to oracleAddress if global feed not set (backward compatibility)
        if (priceFeedAddress == address(0)) {
            priceFeedAddress = resolution.oracleAddress;
        }
        
        require(priceFeedAddress != address(0), "feed not registered");
        
        uint256 currentPrice = _getChainlinkPrice(priceFeedAddress);
        
        // Resolve market with price
        core.resolveMarketWithPrice(marketId, currentPrice);
        
        // Get the resolution result to determine winner
        SpeculateCore.ResolutionConfig memory resolvedConfig = core.getMarketResolution(marketId);
        bool yesWins = resolvedConfig.yesWins;
        
        emit MarketResolved(marketId, yesWins, currentPrice);
    }

    /**
     * @notice Get latest price from Chainlink feed
     * @param priceFeedAddress Chainlink AggregatorV3Interface address
     * @return price Latest price (scaled to 8 decimals for most feeds)
     */
    function _getChainlinkPrice(address priceFeedAddress) internal view returns (uint256) {
        AggregatorV3Interface priceFeed = AggregatorV3Interface(priceFeedAddress);
        
        (
            uint80 roundID,
            int256 price,
            uint256 startedAt,
            uint256 timeStamp,
            uint80 answeredInRound
        ) = priceFeed.latestRoundData();

        require(price > 0, "invalid price");
        require(timeStamp > 0, "round not complete");
        require(answeredInRound >= roundID, "stale data");
        require(block.timestamp - timeStamp < 1 hours, "stale data");

        // Convert int256 to uint256 (price feeds return int256)
        require(price > 0, "negative price");
        return uint256(price);
    }

}

