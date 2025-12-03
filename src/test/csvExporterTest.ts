// src/test/csvExporterTest.ts
import { CSVExporter } from '../storage/csvExporter';
import { PredictedSymbol } from '../prediction/types';

async function testCSVExporter() {
  console.log('🧪 Testing CSV Exporter...\n');

  // Create sample prediction data for demonstration
  const samplePredictions: PredictedSymbol[] = [
    {
      symbol: 'BTCUSDT',
      currentPrice: 87231.7,
      volume24h: 207606645,
      priceChangePercent24h: 2.06,
      prediction: 'BUY',
      confidence: 75,
      timestamp: Date.now(),
      technicalIndicators: {
        macd: { macd: 0.00234, signal: 0.00189, histogram: 0.00045 },
        macdHistory: [],
        volume: { currentVolume: 745.458, averageVolume: 800, volumeRatio: 0.93, volumeTrend: 5.2 },
        currentPrice: 87231.7,
        rsi: 65,
        rsiHistory: [],
        ma: { ma5: 87100, ma10: 87050, ma20: 86900, ma50: 86500 },
        bollingerBands: { upper: 87500, middle: 87200, lower: 86900, bandwidth: 0.34, position: 'NORMAL' },
        priceData: { highs: [], lows: [], closes: [] }
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
      technicalIndicators: {
        macd: { macd: -0.00123, signal: -0.00145, histogram: 0.00022 },
        macdHistory: [],
        volume: { currentVolume: 450.123, averageVolume: 500, volumeRatio: 0.90, volumeTrend: -3.1 },
        currentPrice: 3245.89,
        rsi: 72,
        rsiHistory: [],
        ma: { ma5: 3240, ma10: 3200, ma20: 3180, ma50: 3100 },
        bollingerBands: { upper: 3280, middle: 3240, lower: 3200, bandwidth: 0.25, position: 'OVERBOUGHT' },
        priceData: { highs: [], lows: [], closes: [] }
      }
    },
    {
      symbol: 'BNBUSDT',
      currentPrice: 612.34,
      volume24h: 89000000,
      priceChangePercent24h: 3.45,
      prediction: 'HOLD',
      confidence: 55,
      timestamp: Date.now(),
      technicalIndicators: {
        macd: { macd: 0.00001, signal: 0.00005, histogram: -0.00004 },
        macdHistory: [],
        volume: { currentVolume: 234.567, averageVolume: 250, volumeRatio: 0.94, volumeTrend: 1.2 },
        currentPrice: 612.34,
        rsi: 50,
        rsiHistory: [],
        ma: { ma5: 610, ma10: 608, ma20: 605, ma50: 600 },
        bollingerBands: { upper: 620, middle: 612, lower: 604, bandwidth: 0.26, position: 'NORMAL' },
        priceData: { highs: [], lows: [], closes: [] }
      }
    }
  ];

  // Test 1: Print table view
  console.log('Test 1: Print Table View');
  console.log('-'.repeat(50));
  CSVExporter.printToConsole(samplePredictions);

  // Test 2: Print CSV view
  console.log('\n\nTest 2: Print CSV View');
  console.log('-'.repeat(50));
  CSVExporter.printCsvToConsole(samplePredictions);

  // Test 3: Save to file
  console.log('\n\nTest 3: Save to File');
  console.log('-'.repeat(50));
  try {
    const filepath = CSVExporter.saveToFile(samplePredictions, './output');
    console.log(`✅ File saved successfully at: ${filepath}`);
  } catch (error) {
    console.error(`❌ Error saving file:`, error);
  }

  // Test 4: Generate summary
  console.log('\n\nTest 4: Summary Statistics');
  console.log('-'.repeat(50));
  const summary = CSVExporter.generateSummary(samplePredictions);
  console.log(JSON.stringify(summary, null, 2));

  console.log('\n✅ All CSV exporter tests completed!');
}

if (require.main === module) {
  testCSVExporter();
}