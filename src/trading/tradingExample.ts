// src/trading/tradingExample.ts
// 交易示例文件，展示如何使用OrderManager进行各种类型的交易操作

import { BinanceClient } from '../binance/client';
import { OrderManager, OrderSide, OrderType, TimeInForce } from './orderManager';
import { OpenLongOrder } from './openLongOrder';

import * as dotenv from 'dotenv';
dotenv.config();

/**
 * 交易策略示例类
 */
export class TradingStrategy {
    private binanceClient: BinanceClient;
    private orderManager: OrderManager;
    private openLongOrder: OpenLongOrder;

    constructor(apiKey: string, apiSecret: string) {
        this.binanceClient = new BinanceClient(apiKey, apiSecret);
        this.orderManager = new OrderManager(this.binanceClient);
        this.openLongOrder = new OpenLongOrder(this.binanceClient);
    }

    /**
     * 执行买入策略
     */
    async executeBuyStrategy(symbol: string, quantity: number, price: number): Promise<void> {
        try {
            console.log(`🚀 Executing buy strategy for ${symbol}`);
            
            // 1. 使用OpenLongOrder创建市价买单
            const longOrder = await this.openLongOrder.execute({
                symbol,
                quantity,
                positionSide: "LONG"
            });
            
            console.log(`✅ Long position opened: ${longOrder.orderId}`);
            
            // 2. 设置止损单
            const stopLossPrice = price * 0.9; // 止损50%
            const stopOrder = await this.orderManager.createStopOrder(
                symbol,
                OrderSide.SELL,
                quantity,
                stopLossPrice,
                undefined, // 市价止损
                undefined,
                undefined // reduceOnly
            );
            
            console.log(`✅ Stop loss order created: ${stopOrder.orderId}`);
            
            // // 3. 设置止盈单
            // const takeProfitPrice = price * 1.10; // 止盈10%
            // const takeProfitOrder = await this.orderManager.createTakeProfitOrder(
            //     symbol,
            //     OrderSide.SELL,
            //     quantity,
            //     takeProfitPrice,
            //     undefined, // 市价止盈
            //     undefined,
            //     true // reduceOnly
            // );
            
            // console.log(`✅ Take profit order created: ${takeProfitOrder.orderId}`);
            
        } catch (error) {
            console.error(`❌ Error executing buy strategy for ${symbol}:`, error);
        }
    }

    /**
     * 执行卖出策略
     */
    async executeSellStrategy(symbol: string, quantity: number, price: number): Promise<void> {
        try {
            console.log(`🚀 Executing sell strategy for ${symbol}`);
            
            // 1. 创建限价卖单
            const limitOrder = await this.orderManager.createLimitOrder(
                symbol, 
                OrderSide.SELL, 
                quantity, 
                price,
                TimeInForce.GTC
            );
            
            console.log(`✅ Limit sell order created: ${limitOrder.orderId}`);
            
            // 2. 设置止损单
            const stopLossPrice = price * 1.05; // 止损5%
            const stopOrder = await this.orderManager.createStopOrder(
                symbol,
                OrderSide.BUY,
                quantity,
                stopLossPrice,
                undefined, // 市价止损
                undefined,
                true // reduceOnly
            );
            
            console.log(`✅ Stop loss order created: ${stopOrder.orderId}`);
            
            // 3. 设置止盈单
            const takeProfitPrice = price * 0.90; // 止盈10%
            const takeProfitOrder = await this.orderManager.createTakeProfitOrder(
                symbol,
                OrderSide.BUY,
                quantity,
                takeProfitPrice,
                undefined, // 市价止盈
                undefined,
                true // reduceOnly
            );
            
            console.log(`✅ Take profit order created: ${takeProfitOrder.orderId}`);
            
        } catch (error) {
            console.error(`❌ Error executing sell strategy for ${symbol}:`, error);
        }
    }

    /**
     * 创建追踪止损单
     */
    async createTrailingStop(symbol: string, quantity: number, callbackRate: number): Promise<void> {
        try {
            console.log(`🚀 Creating trailing stop for ${symbol}`);
            
            // 创建追踪止损市价单
            const trailingStopOrder = await this.orderManager.createOrder({
                symbol,
                side: OrderSide.SELL,
                type: OrderType.TRAILING_STOP_MARKET,
                quantity,
                callbackRate,
                reduceOnly: true
            });
            
            console.log(`✅ Trailing stop order created: ${trailingStopOrder.orderId}`);
        } catch (error) {
            console.error(`❌ Error creating trailing stop for ${symbol}:`, error);
        }
    }

    /**
     * 取消所有订单
     */
    async cancelAllOrders(symbol: string): Promise<void> {
        try {
            console.log(`🗑️  Cancelling all orders for ${symbol}`);
            
            // 注意：这需要调用Binance的批量撤单接口
            // 在此示例中，我们只演示单个订单的取消
            
            console.log(`⚠️  Batch cancel not implemented in this example`);
        } catch (error) {
            console.error(`❌ Error cancelling orders for ${symbol}:`, error);
        }
    }
}

/**
 * 使用示例
 */
async function example() {
    // 从环境变量获取API密钥
    const apiKey = process.env.BINANCE_API_KEY || '';
    const apiSecret = process.env.BINANCE_API_SECRET || '';
    
    if (!apiKey || !apiSecret) {
        console.log('⚠️  Please set BINANCE_API_KEY and BINANCE_API_SECRET environment variables');
        return;
    }
    
    const strategy = new TradingStrategy(apiKey, apiSecret);
    
    // 示例：执行买入策略 (使用符合精度要求的数量)
    await strategy.executeBuyStrategy('BTCUSDT', 0.002, 88000);
    
    // 示例：执行卖出策略
    // await strategy.executeSellStrategy('BTCUSDT', 0.001, 52000);
    
    // 示例：创建追踪止损
    // await strategy.createTrailingStop('BTCUSDT', 0.001, 1.0); // 1%回调率
    
    console.log('💡 Trading examples ready. Uncomment the strategy calls to execute trades.');
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
    example();
}

// const longParams: LongOrderParams = {
//     symbol: 'BTCUSDT',
//     side: 'BUY',
//     positionSide: 'LONG', //Binance API Error (400): {"code":-4061,"msg":"Order's position side does not match user's setting."}
//     type: 'MARKET',
//     quantity: 0.001, //BTC 数量
//     timestamp: Date.now(),
// };

// npx ts-node src/trading/tradingExample.ts

// npm warn Unknown user config "home". This will stop working in the next major version of npm.
// 🚀 Executing buy strategy for BTCUSDT
// 📈 Opening long position for BTCUSDT...
// 📝 Creating market order for BTCUSDT with params: {
//   symbol: 'BTCUSDT',
//   side: 'BUY',
//   type: 'MARKET',
//   quantity: '0.002',
//   positionSide: 'LONG',
//   timestamp: 1765116373647,
//   recvWindow: 5000
// }
// ✅ Long position opened successfully. Order ID: 848789328656
// ✅ Long position opened: 848789328656
// 📝 Creating STOP_MARKET order for BTCUSDT...
// 📝 Creating STOP_MARKET order for BTCUSDT with params: {
//   symbol: 'BTCUSDT',
//   side: 'SELL',
//   type: 'STOP_MARKET',
//   quantity: '0.002',
//   stopPrice: '79200',
//   positionSide: 'SHORT'
// }
// ✅ Order created successfully. Order ID: 848789329566
// ✅ Stop loss order created: 848789329566
// 💡 Trading examples ready. Uncomment the strategy calls to execute trades.