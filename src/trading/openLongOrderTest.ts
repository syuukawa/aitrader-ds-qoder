// src/trading/openLongOrderTest.ts
// 简单测试文件，用于测试OpenLongOrder功能

import { BinanceClient } from '../binance/client';
import { OpenLongOrder } from './openLongOrder';
import * as dotenv from 'dotenv';

dotenv.config();

async function testOpenLongOrder() {
    // 从环境变量获取API密钥
    const apiKey = process.env.BINANCE_API_KEY || '';
    const apiSecret = process.env.BINANCE_API_SECRET || '';
    
    if (!apiKey || !apiSecret) {
        console.log('⚠️  Please set BINANCE_API_KEY and BINANCE_API_SECRET environment variables');
        return;
    }
    
    try {
        // 创建Binance客户端和OpenLongOrder实例
        const binanceClient = new BinanceClient(apiKey, apiSecret);
        const openLongOrder = new OpenLongOrder(binanceClient);
        
        // 测试开多单（使用符合精度要求的数量以避免实际交易）
        console.log('🚀 Testing OpenLongOrder with proper quantity precision...');
        
        const result = await openLongOrder.execute({
            symbol: 'BTCUSDT',
            quantity: 0.002, // 符合BTC精度要求的数量
            positionSide: 'LONG'
        });
        
        console.log('✅ OpenLongOrder test completed successfully:');
        console.log('Order ID:', result.orderId);
        console.log('Symbol:', result.symbol);
        console.log('Status:', result.status);
        console.log('Side:', result.side);
        console.log('Position Side:', result.positionSide);
        
    } catch (error) {
        console.error('❌ Error in OpenLongOrder test:', error);
    }
}

// 如果直接运行此文件，则执行测试
if (require.main === module) {
    testOpenLongOrder();
}

// 运行命令: npx ts-node src/trading/openLongOrderTest.ts
// 🚀 Testing OpenLongOrder with proper quantity precision...
// 📈 Opening long position for BTCUSDT...
// 📝 Creating market order for BTCUSDT with params: {
//   symbol: 'BTCUSDT',
//   side: 'BUY',
//   type: 'MARKET',
//   quantity: '0.002',
//   positionSide: 'LONG',
//   timestamp: 1765115349969,
//   recvWindow: 5000
// }
// ✅ Long position opened successfully. Order ID: 848776663425
// ✅ OpenLongOrder test completed successfully:
// Order ID: 848776663425
// Symbol: BTCUSDT
// Status: NEW
// Side: BUY
// Position Side: LONG