import { BigInt, Bytes, log } from '@graphprotocol/graph-ts'
import {
  MarketCreated as MarketCreatedEvent,
  BuyYes as BuyYesEvent,
  BuyNo as BuyNoEvent,
  SellYes as SellYesEvent,
  SellNo as SellNoEvent,
} from '../generated/SpeculateCore/SpeculateCore'
import { Market, Trade, Holder, Candle } from '../generated/schema'

// Helper to get or create market
function getOrCreateMarket(marketId: BigInt): Market {
  let id = marketId.toString()
  let market = Market.load(id)
  
  if (market == null) {
    market = new Market(id)
    market.marketId = marketId
    market.reserveYes = BigInt.zero()
    market.reserveNo = BigInt.zero()
    market.usdcVault = BigInt.zero()
    market.totalPairsUSDC = BigInt.zero()
    market.feeTreasuryBps = 0
    market.feeVaultBps = 0
    market.feeLpBps = 0
    market.maxTradeBps = 0
    market.status = 0
    market.sellFees = false
    market.createdAt = BigInt.zero()
    market.question = ''
    market.coreAddress = Bytes.empty()
    market.yesToken = Bytes.empty()
    market.noToken = Bytes.empty()
    market.creator = Bytes.empty()
    market.lp = Bytes.empty()
  }
  
  return market as Market
}

// Helper to get or create holder
function getOrCreateHolder(marketId: BigInt, user: Bytes, sideYes: boolean, tokenAddress: Bytes): Holder {
  let id = marketId.toString() + '-' + user.toHex() + '-' + (sideYes ? 'yes' : 'no')
  let holder = Holder.load(id)
  
  if (holder == null) {
    holder = new Holder(id)
    holder.marketId = marketId
    holder.user = user
    holder.sideYes = sideYes
    holder.tokenAddress = tokenAddress
    holder.balance = BigInt.zero()
    holder.totalBought = BigInt.zero()
    holder.totalSold = BigInt.zero()
    holder.totalSpent = BigInt.zero()
    holder.totalReceived = BigInt.zero()
    holder.lastUpdated = BigInt.zero()
    let market = getOrCreateMarket(marketId)
    holder.market = market.id
  }
  
  return holder as Holder
}

// Helper to upsert candle
function upsertCandle(marketId: BigInt, timestamp: BigInt, priceYesE6: BigInt, priceNoE6: BigInt, volume: BigInt, timeframe: string): Candle {
  let bucketSeconds = timeframe == '5m' ? 300 : timeframe == '1h' ? 3600 : 86400
  let startTs = (timestamp.toI32() / bucketSeconds) * bucketSeconds
  let startTimestamp = BigInt.fromI32(startTs)
  let id = marketId.toString() + '-' + timeframe + '-' + startTimestamp.toString()
  
  let candle = Candle.load(id)
  let market = getOrCreateMarket(marketId)
  
  if (candle == null) {
    candle = new Candle(id)
    candle.market = market.id
    candle.marketId = marketId
    candle.timeframe = timeframe
    candle.startTimestamp = startTimestamp
    candle.openYES = priceYesE6
    candle.highYES = priceYesE6
    candle.lowYES = priceYesE6
    candle.closeYES = priceYesE6
    candle.openNO = priceNoE6
    candle.highNO = priceNoE6
    candle.lowNO = priceNoE6
    candle.closeNO = priceNoE6
    candle.volume = volume
    candle.trades = BigInt.fromI32(1)
  } else {
    if (priceYesE6.gt(candle.highYES)) candle.highYES = priceYesE6
    if (priceYesE6.lt(candle.lowYES)) candle.lowYES = priceYesE6
    candle.closeYES = priceYesE6
    if (priceNoE6.gt(candle.highNO)) candle.highNO = priceNoE6
    if (priceNoE6.lt(candle.lowNO)) candle.lowNO = priceNoE6
    candle.closeNO = priceNoE6
    candle.volume = candle.volume.plus(volume)
    candle.trades = candle.trades.plus(BigInt.fromI32(1))
  }
  
  return candle as Candle
}

// Handle MarketCreated event
// MarketCreated(indexed uint256,address,address,string,uint256,uint256,uint256)
// id, yes, no, question, reserveYes, reserveNo, usdcVault
export function handleMarketCreated(event: MarketCreatedEvent): void {
  let marketId = event.params.id
  let market = getOrCreateMarket(marketId)
  
  market.coreAddress = event.address
  market.yesToken = event.params.yes
  market.noToken = event.params.no
  market.question = event.params.question
  market.reserveYes = event.params.reserveYes
  market.reserveNo = event.params.reserveNo
  market.usdcVault = event.params.usdcVault
  market.totalPairsUSDC = event.params.usdcVault
  market.createdAt = event.block.timestamp
  market.creator = event.transaction.from
  
  market.save()
}

// Handle BuyYes event
// BuyYes(indexed uint256,indexed address,uint256,uint256,uint256)
// id, user, usdcIn, tokensOut, priceE6
export function handleBuyYes(event: BuyYesEvent): void {
  let marketId = event.params.id
  let market = getOrCreateMarket(marketId)
  
  // Create trade entity
  let tradeId = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let trade = new Trade(tradeId)
  trade.market = market.id
  trade.marketId = marketId
  trade.user = event.params.user
  trade.type = 'BuyYes'
  trade.sideYes = true
  trade.isBuy = true
  trade.usdcAmount = event.params.usdcIn
  trade.tokenAmount = event.params.tokensOut
  trade.priceE6 = event.params.priceE6
  trade.timestamp = event.block.timestamp
  trade.blockNumber = event.block.number
  trade.txHash = event.transaction.hash
  trade.logIndex = event.logIndex
  trade.feeTreasury = BigInt.zero()
  trade.feeVault = BigInt.zero()
  trade.feeLp = BigInt.zero()
  trade.save()
  
  // Update holder
  let holder = getOrCreateHolder(marketId, event.params.user, true, market.yesToken)
  holder.balance = holder.balance.plus(event.params.tokensOut)
  holder.totalBought = holder.totalBought.plus(event.params.tokensOut)
  holder.totalSpent = holder.totalSpent.plus(event.params.usdcIn)
  holder.lastUpdated = event.block.timestamp
  holder.market = market.id
  holder.save()
  
  // Create/update candles
  let priceNoE6 = BigInt.fromI32(1000000).minus(event.params.priceE6)
  let timeframes = ['5m', '1h', '1d']
  for (let i = 0; i < timeframes.length; i++) {
    let candle = upsertCandle(marketId, event.block.timestamp, event.params.priceE6, priceNoE6, event.params.usdcIn, timeframes[i])
    candle.market = market.id
    candle.save()
  }
}

// Handle BuyNo event
export function handleBuyNo(event: BuyNoEvent): void {
  let marketId = event.params.id
  let market = getOrCreateMarket(marketId)
  
  let tradeId = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let trade = new Trade(tradeId)
  trade.market = market.id
  trade.marketId = marketId
  trade.user = event.params.user
  trade.type = 'BuyNo'
  trade.sideYes = false
  trade.isBuy = true
  trade.usdcAmount = event.params.usdcIn
  trade.tokenAmount = event.params.tokensOut
  trade.priceE6 = event.params.priceE6
  trade.timestamp = event.block.timestamp
  trade.blockNumber = event.block.number
  trade.txHash = event.transaction.hash
  trade.logIndex = event.logIndex
  trade.feeTreasury = BigInt.zero()
  trade.feeVault = BigInt.zero()
  trade.feeLp = BigInt.zero()
  trade.save()
  
  let holder = getOrCreateHolder(marketId, event.params.user, false, market.noToken)
  holder.balance = holder.balance.plus(event.params.tokensOut)
  holder.totalBought = holder.totalBought.plus(event.params.tokensOut)
  holder.totalSpent = holder.totalSpent.plus(event.params.usdcIn)
  holder.lastUpdated = event.block.timestamp
  holder.market = market.id
  holder.save()
  
  let priceYesE6 = BigInt.fromI32(1000000).minus(event.params.priceE6)
  let timeframes = ['5m', '1h', '1d']
  for (let i = 0; i < timeframes.length; i++) {
    let candle = upsertCandle(marketId, event.block.timestamp, priceYesE6, event.params.priceE6, event.params.usdcIn, timeframes[i])
    candle.market = market.id
    candle.save()
  }
}

// Handle SellYes event
export function handleSellYes(event: SellYesEvent): void {
  let marketId = event.params.id
  let market = getOrCreateMarket(marketId)
  
  let tradeId = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let trade = new Trade(tradeId)
  trade.market = market.id
  trade.marketId = marketId
  trade.user = event.params.user
  trade.type = 'SellYes'
  trade.sideYes = true
  trade.isBuy = false
  trade.usdcAmount = event.params.usdcOut
  trade.tokenAmount = event.params.tokensIn
  trade.priceE6 = event.params.priceE6
  trade.timestamp = event.block.timestamp
  trade.blockNumber = event.block.number
  trade.txHash = event.transaction.hash
  trade.logIndex = event.logIndex
  trade.feeTreasury = BigInt.zero()
  trade.feeVault = BigInt.zero()
  trade.feeLp = BigInt.zero()
  trade.save()
  
  let holder = getOrCreateHolder(marketId, event.params.user, true, market.yesToken)
  holder.balance = holder.balance.minus(event.params.tokensIn)
  holder.totalSold = holder.totalSold.plus(event.params.tokensIn)
  holder.totalReceived = holder.totalReceived.plus(event.params.usdcOut)
  holder.lastUpdated = event.block.timestamp
  holder.market = market.id
  holder.save()
  
  let priceNoE6 = BigInt.fromI32(1000000).minus(event.params.priceE6)
  let timeframes = ['5m', '1h', '1d']
  for (let i = 0; i < timeframes.length; i++) {
    let candle = upsertCandle(marketId, event.block.timestamp, event.params.priceE6, priceNoE6, event.params.usdcOut, timeframes[i])
    candle.market = market.id
    candle.save()
  }
}

// Handle SellNo event
export function handleSellNo(event: SellNoEvent): void {
  let marketId = event.params.id
  let market = getOrCreateMarket(marketId)
  
  let tradeId = event.transaction.hash.toHex() + '-' + event.logIndex.toString()
  let trade = new Trade(tradeId)
  trade.market = market.id
  trade.marketId = marketId
  trade.user = event.params.user
  trade.type = 'SellNo'
  trade.sideYes = false
  trade.isBuy = false
  trade.usdcAmount = event.params.usdcOut
  trade.tokenAmount = event.params.tokensIn
  trade.priceE6 = event.params.priceE6
  trade.timestamp = event.block.timestamp
  trade.blockNumber = event.block.number
  trade.txHash = event.transaction.hash
  trade.logIndex = event.logIndex
  trade.feeTreasury = BigInt.zero()
  trade.feeVault = BigInt.zero()
  trade.feeLp = BigInt.zero()
  trade.save()
  
  let holder = getOrCreateHolder(marketId, event.params.user, false, market.noToken)
  holder.balance = holder.balance.minus(event.params.tokensIn)
  holder.totalSold = holder.totalSold.plus(event.params.tokensIn)
  holder.totalReceived = holder.totalReceived.plus(event.params.usdcOut)
  holder.lastUpdated = event.block.timestamp
  holder.market = market.id
  holder.save()
  
  let priceYesE6 = BigInt.fromI32(1000000).minus(event.params.priceE6)
  let timeframes = ['5m', '1h', '1d']
  for (let i = 0; i < timeframes.length; i++) {
    let candle = upsertCandle(marketId, event.block.timestamp, priceYesE6, event.params.priceE6, event.params.usdcOut, timeframes[i])
    candle.market = market.id
    candle.save()
  }
}
