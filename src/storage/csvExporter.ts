// src/storage/csvExporter.ts
import * as fs from 'fs';
import * as path from 'path';
import { PredictedSymbol } from '../prediction/types';

export class CSVExporter {
    /**
     * Convert timestamp to Beijing time (UTC+8) string
     */
    private static toBeiJingTime(timestamp: number): string {
        const date = new Date(timestamp);
        // Add 8 hours to convert UTC to Beijing time
        const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
        return beijingDate.toISOString().replace('Z', '+08:00').slice(0, 19);
    }

    /**
     * Convert timestamp to Beijing time ISO string
     */
    private static toBeiJingTimeISO(timestamp: number): string {
        const date = new Date(timestamp);
        // Add 8 hours to convert UTC to Beijing time
        const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
        return beijingDate.toISOString().replace('Z', '+08:00');
    }
    /**
     * Export predictions to CSV format
     */
    static toCsvString(predictions: PredictedSymbol[]): string {
        if (predictions.length === 0) {
            return 'No predictions available';
        }

        // CSV Header
        const headers = [
            'Symbol',
            'Current Price',
            'Volume 24h (USDT)',
            'Open Interest Value (USDT)',
            'Price Change 24h (%)',
            'MACD',
            'MACD Signal',
            'MACD Histogram',
            'RSI',
            'MA5',
            'MA10',
            'MA20',
            'MA50',
            'Bollinger Upper',
            'Bollinger Middle',
            'Bollinger Lower',
            'Bollinger Position',
            'Volume Ratio',
            'Volume Trend',
            'Prediction',
            'Confidence (%)',
            'Latest OI Value',
            'Latest OI Time',
            'OI Growth Rate (%)',
            'Timestamp'
        ];

        const rows: string[] = [headers.map(h => this.escapeCsvField(h)).join(',')];

        // CSV Data Rows
        for (const prediction of predictions) {
            const indicators = prediction.technicalIndicators;
            // Get latest OI data if available
            let latestOiValue = 'N/A';
            let latestOiTime = 'N/A';
            let oiGrowthRate = 'N/A';
            if (prediction.openInterestData && prediction.openInterestData.length > 0) {
                const latestOi = prediction.openInterestData[prediction.openInterestData.length - 1];
                latestOiValue = latestOi.sumOpenInterestValue;
                latestOiTime = latestOi.timestamp.toString();
                
                // Calculate OI growth rate if we have trend data
                if (indicators.openInterestTrend) {
                    oiGrowthRate = indicators.openInterestTrend.growthRate.toFixed(2);
                }
            }            
            const row = [
                prediction.symbol,
                prediction.currentPrice.toFixed(8),
                prediction.volume24h.toFixed(2),
                (prediction.sumOpenInterestValue || 0).toFixed(2),
                prediction.priceChangePercent24h.toFixed(2),
                indicators.macd?.macd?.toFixed(8) || 'N/A',
                indicators.macd?.signal?.toFixed(8) || 'N/A',
                indicators.macd?.histogram?.toFixed(8) || 'N/A',
                indicators.rsi?.toFixed(2) || 'N/A',
                indicators.ma?.ma5?.toFixed(8) || 'N/A',
                indicators.ma?.ma10?.toFixed(8) || 'N/A',
                indicators.ma?.ma20?.toFixed(8) || 'N/A',
                indicators.ma?.ma50?.toFixed(8) || 'N/A',
                indicators.bollingerBands?.upper?.toFixed(8) || 'N/A',
                indicators.bollingerBands?.middle?.toFixed(8) || 'N/A',
                indicators.bollingerBands?.lower?.toFixed(8) || 'N/A',
                indicators.bollingerBands?.position || 'N/A',
                indicators.volume?.volumeRatio?.toFixed(4) || 'N/A',
                indicators.volume?.volumeTrend?.toFixed(6) || 'N/A',
                prediction.prediction || 'HOLD',
                (prediction.confidence || 0).toFixed(1),
                latestOiValue,
                latestOiTime,
                oiGrowthRate,
                this.toBeiJingTimeISO(prediction.timestamp)
            ];

            rows.push(row.map(field => this.escapeCsvField(String(field))).join(','));
        }

        return rows.join('\n');
    }

    /**
     * Save predictions to CSV file
     */
    static saveToFile(predictions: PredictedSymbol[], outputDir: string = './output'): string {
        // Create output directory if it doesn't exist
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Generate filename with Beijing timestamp
        const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const dateStr = beijingDate.toISOString().split('T')[0]; // YYYY-MM-DD
        const timeStr = beijingDate.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-'); // HH-MM-SS

        const filename = `predictions_${dateStr}_${timeStr}.csv`;
        const filepath = path.join(outputDir, filename);

        // Write to file
        const csvContent = this.toCsvString(predictions);
        fs.writeFileSync(filepath, csvContent, 'utf-8');

        console.log(`\n📁 CSV file saved: ${filepath}`);
        return filepath;
    }

    /**
     * Print predictions to console in table format
     */
    static printToConsole(predictions: PredictedSymbol[]): void {
        if (predictions.length === 0) {
            console.log('No predictions to display');
            return;
        }

        console.log('\n' + '='.repeat(165));
        console.log('PREDICTION RESULTS - TABLE VIEW');
        console.log('='.repeat(165));

        // Print header
        const headers = [
            'Symbol'.padEnd(12),
            'Price'.padEnd(12),
            'Vol 24h'.padEnd(12),
            'OI Value'.padEnd(12),
            'Chg%'.padEnd(8),
            'MACD'.padEnd(10),
            'RSI'.padEnd(8),
            'BB Pos'.padEnd(10),
            'Vol Ratio'.padEnd(10),
            'Prediction'.padEnd(12),
            'Conf%'.padEnd(8),
            'Latest OI'.padEnd(12),
            'OI Growth%'.padEnd(12),
            'Timestamp'.padEnd(20)
        ];
        console.log(headers.join('│'));
        console.log('-'.repeat(165));

        // Print data rows
        for (const prediction of predictions) {
            const indicators = prediction.technicalIndicators;
            const macdValue = indicators.macd?.macd?.toFixed(4) || 'N/A';
            const rsiValue = indicators.rsi?.toFixed(2) || 'N/A';
            const bbPosition = indicators.bollingerBands?.position || 'N/A';
            const volumeRatio = indicators.volume?.volumeRatio?.toFixed(2) || 'N/A';
            const timestamp = this.toBeiJingTime(prediction.timestamp);
            
            // Get latest OI data if available
            let latestOiValue = 'N/A';
            let oiGrowthRate = 'N/A';
            if (prediction.openInterestData && prediction.openInterestData.length > 0) {
                const latestOi = prediction.openInterestData[prediction.openInterestData.length - 1];
                latestOiValue = (parseFloat(latestOi.sumOpenInterestValue) / 1000000).toFixed(1) + 'M';
                
                // Get OI growth rate if available
                if (indicators.openInterestTrend) {
                    oiGrowthRate = indicators.openInterestTrend.growthRate.toFixed(2) + '%';
                }
            }

            const row = [
                prediction.symbol.padEnd(12),
                prediction.currentPrice.toFixed(4).padEnd(12),
                (prediction.volume24h / 1000000).toFixed(1).padEnd(12) + 'M',
                ((prediction.sumOpenInterestValue || 0) / 1000000).toFixed(1).padEnd(12) + 'M',
                prediction.priceChangePercent24h.toFixed(2).padEnd(8),
                macdValue.padEnd(10),
                rsiValue.padEnd(8),
                bbPosition.padEnd(10),
                volumeRatio.padEnd(10),
                (prediction.prediction || 'HOLD').padEnd(12),
                ((prediction.confidence || 0).toFixed(1)).padEnd(8),
                latestOiValue.padEnd(12),
                oiGrowthRate.padEnd(12),
                timestamp.padEnd(20)
            ];
            console.log(row.join('│'));
        }

        console.log('='.repeat(165));
        console.log(`Total Symbols: ${predictions.length}`);
        console.log('='.repeat(150));
    }

    /**
     * Print CSV content to console
     */
    static printCsvToConsole(predictions: PredictedSymbol[]): void {
        const csvContent = this.toCsvString(predictions);
        console.log('\n' + '='.repeat(80));
        console.log('PREDICTION RESULTS - CSV FORMAT');
        console.log('='.repeat(80));
        console.log(csvContent);
        console.log('='.repeat(80));
    }

    /**
     * Escape CSV field to handle special characters
     */
    private static escapeCsvField(field: string): string {
        // If field contains comma, newline, or double quote, wrap it in quotes and escape internal quotes
        if (field.includes(',') || field.includes('\n') || field.includes('"')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    }

    /**
     * Generate summary statistics
     */
    static generateSummary(predictions: PredictedSymbol[]): object {
        if (predictions.length === 0) {
            return {
                totalSymbols: 0,
                message: 'No predictions available'
            };
        }

        const buySignals = predictions.filter(p => p.prediction === 'BUY').length;
        const sellSignals = predictions.filter(p => p.prediction === 'SELL').length;
        const holdSignals = predictions.filter(p => p.prediction === 'HOLD').length;

        const avgConfidence = predictions.reduce((sum, p) => sum + (p.confidence || 0), 0) / predictions.length;
        const avgPrice = predictions.reduce((sum, p) => sum + p.currentPrice, 0) / predictions.length;
        const totalVolume = predictions.reduce((sum, p) => sum + p.volume24h, 0);

        return {
            totalSymbols: predictions.length,
            buySignals,
            sellSignals,
            holdSignals,
            averageConfidence: avgConfidence.toFixed(2),
            averagePrice: avgPrice.toFixed(8),
            totalVolume: totalVolume.toFixed(2),
            topPrediction: predictions[0]?.symbol || 'N/A'
        };
    }
}