"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("../binance/client");
async function test() {
    console.log('🧪 Testing AI Trader components...');
    try {
        console.log('Testing Binance client...');
        const binanceClient = new client_1.BinanceClient();
        console.log('Fetching BTCUSDT 24hr ticker data...');
        const btcData = await binanceClient.get24hrTicker('BTCUSDT');
        console.log('BTCUSDT data:', btcData);
        console.log('Fetching BTCUSDT Klines...');
        const klines = await binanceClient.getKlines('BTCUSDT', '15m', 10);
        console.log(`Retrieved ${klines.length} klines`);
        console.log('First kline:', klines[0]);
        console.log('✅ All tests passed!');
    }
    catch (error) {
        console.error('❌ Test failed:', error);
    }
}
if (require.main === module) {
    test();
}
//# sourceMappingURL=test.js.map