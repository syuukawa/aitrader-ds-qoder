// src/test/duckdbTest.ts
import { PredictionDbHandler } from '../duckdb/predictionDbHandler';
import { PredictedSymbol } from '../prediction/types';

async function testDuckDB() {
    console.log('🧪 Testing DuckDB Handler...\n');
    
    // 创建示例预测数据
    const samplePredictions: PredictedSymbol[] = [
        {
            symbol: 'BTCUSDT',
            currentPrice: 87231.7,
            volume24h: 207606645,
            priceChangePercent24h: 2.06,
            prediction: 'BUY',
            confidence: 75,
            timestamp: Date.now(),
            openInterestData: [{
                symbol: 'BTCUSDT',
                sumOpenInterest: '12345.67',
                sumOpenInterestValue: '1234567890',
                timestamp: Date.now()
            }],
            technicalIndicators: {
                macd: { macd: 0.00234, signal: 0.00189, histogram: 0.00045 },
                macdHistory: [],
                volume: { currentVolume: 745.458, averageVolume: 800, volumeRatio: 0.93, volumeTrend: 5.2 },
                currentPrice: 87231.7,
                rsi: 65,
                rsiHistory: [],
                ma: { ma5: 87100, ma10: 87050, ma20: 86900, ma50: 86500 },
                bollingerBands: { upper: 87500, middle: 87200, lower: 86900, bandwidth: 0.34, position: 'NORMAL' },
                priceData: { highs: [], lows: [], closes: [] },
                openInterestTrend: { 
                    trend: 'UP', 
                    strength: 85, 
                    growthRate: 2.5,
                    averageOI: 1234567890,
                    latestOI: 1234567890,
                    volatility: 0.1
                }
            }
        },
        {
            symbol: 'ETHUSDT',
            currentPrice: 3245.89,
            volume24h: 125000000,
            priceChangePercent24h: 5.34,
            prediction: 'SELL',
            confidence: 68,
            timestamp: Date.now(),
            openInterestData: [{
                symbol: 'ETHUSDT',
                sumOpenInterest: '9876.54',
                sumOpenInterestValue: '987654321',
                timestamp: Date.now()
            }],
            technicalIndicators: {
                macd: { macd: -0.00123, signal: 0.00045, histogram: -0.00168 },
                macdHistory: [],
                volume: { currentVolume: 450.215, averageVolume: 400, volumeRatio: 1.13, volumeTrend: -2.1 },
                currentPrice: 3245.89,
                rsi: 72,
                rsiHistory: [],
                ma: { ma5: 3250, ma10: 3240, ma20: 3220, ma50: 3200 },
                bollingerBands: { upper: 3280, middle: 3240, lower: 3200, bandwidth: 0.42, position: 'NORMAL' },
                priceData: { highs: [], lows: [], closes: [] },
                openInterestTrend: { 
                    trend: 'DOWN', 
                    strength: 70, 
                    growthRate: -1.8,
                    averageOI: 987654321,
                    latestOI: 987654321,
                    volatility: 0.2
                }
            }
        }
    ];

    try {
        // 初始化数据库处理器
        const dbHandler = new PredictionDbHandler({
            databasePath: './duckdb-data/test_aitrader.duckdb',
            tableName: 'test_predictions'
        });

        await dbHandler.initialize();
        console.log('✅ DuckDB handler initialized');

        // 插入预测数据
        await dbHandler.insertPredictions(samplePredictions);
        console.log('✅ Predictions inserted successfully');

        // 查询数据
        const queryResult = await dbHandler.queryPredictions(
            'SELECT symbol, current_price, prediction, confidence FROM test_predictions ORDER BY confidence DESC'
        );
        console.log('\n🔍 Query Result:');
        console.log(queryResult);

        // 关闭连接
        await dbHandler.close();
        console.log('✅ DuckDB handler closed');

        console.log('\n🎉 All DuckDB tests passed!');
    } catch (error) {
        console.error('❌ Error during DuckDB test:', error);
    }
}

if (require.main === module) {
    testDuckDB();
}