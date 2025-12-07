// src/test/orderManagerTest.ts
import { BinanceClient } from '../binance/client';
import { OrderManager, OrderSide, OrderType } from '../trading/orderManager';

async function testOrderManager() {
    console.log('🧪 Testing Order Manager...\n');
    
    // 从环境变量获取API密钥（在实际使用中应该设置这些值）
    const apiKey = process.env.BINANCE_API_KEY || '';
    const apiSecret = process.env.BINANCE_API_SECRET || '';
    
    if (!apiKey || !apiSecret) {
        console.log('⚠️  API keys not found in environment variables. Skipping order creation test.');
        console.log('💡 Please set BINANCE_API_KEY and BINANCE_API_SECRET environment variables to test trading.');
        return;
    }
    
    try {
        // 初始化Binance客户端和订单管理器
        const binanceClient = new BinanceClient(apiKey, apiSecret);
        const orderManager = new OrderManager(binanceClient);
        
        console.log('✅ Order Manager initialized');
        
        // 测试获取订单状态（使用一个不存在的订单ID，应该会返回错误）
        try {
            console.log('\n🔍 Testing getOrder with non-existent order...');
            await orderManager.getOrder('BTCUSDT', 123456789);
        } catch (error) {
            console.log('✅ getOrder test completed (expected error for non-existent order)');
        }
        
        console.log('\n🎉 Order Manager tests completed!');
        
    } catch (error) {
        console.error('❌ Error during Order Manager test:', error);
    }
}

if (require.main === module) {
    testOrderManager();
}