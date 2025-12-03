// src/test/test.ts
import { BinanceClient } from '../binance/client';
import { MarketPredictor } from '../prediction/marketPredictor';

async function test() {
  console.log('🧪 Testing AI Trader components...');
  
  try {
    // Test Binance client
    console.log('Testing Binance client...');
    const binanceClient = new BinanceClient();
    
    // Test fetching a single symbol's data
    console.log('Fetching BTCUSDT 24hr ticker data...');
    const btcData = await binanceClient.get24hrTicker('BTCUSDT');
    console.log('BTCUSDT data:', btcData);
    
    // Test fetching Klines
    console.log('Fetching BTCUSDT Klines...');
    const klines = await binanceClient.getKlines('BTCUSDT', '15m', 10);
    console.log(`Retrieved ${klines.length} klines`);
    console.log('First kline:', klines[0]);
    
    console.log('✅ All tests passed!');
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

if (require.main === module) {
  test();
}