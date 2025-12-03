"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CSVExporter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CSVExporter {
    static toBeiJingTime(timestamp) {
        const date = new Date(timestamp);
        const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
        return beijingDate.toISOString().replace('Z', '+08:00').slice(0, 19);
    }
    static toBeiJingTimeISO(timestamp) {
        const date = new Date(timestamp);
        const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
        return beijingDate.toISOString().replace('Z', '+08:00');
    }
    static toCsvString(predictions) {
        if (predictions.length === 0) {
            return 'No predictions available';
        }
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
            'Timestamp'
        ];
        const rows = [headers.map(h => this.escapeCsvField(h)).join(',')];
        for (const prediction of predictions) {
            const indicators = prediction.technicalIndicators;
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
                this.toBeiJingTimeISO(prediction.timestamp)
            ];
            rows.push(row.map(field => this.escapeCsvField(String(field))).join(','));
        }
        return rows.join('\n');
    }
    static saveToFile(predictions, outputDir = './output') {
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }
        const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const dateStr = beijingDate.toISOString().split('T')[0];
        const timeStr = beijingDate.toISOString().split('T')[1].split('.')[0].replace(/:/g, '-');
        const filename = `predictions_${dateStr}_${timeStr}.csv`;
        const filepath = path.join(outputDir, filename);
        const csvContent = this.toCsvString(predictions);
        fs.writeFileSync(filepath, csvContent, 'utf-8');
        console.log(`\n📁 CSV file saved: ${filepath}`);
        return filepath;
    }
    static printToConsole(predictions) {
        if (predictions.length === 0) {
            console.log('No predictions to display');
            return;
        }
        console.log('\n' + '='.repeat(165));
        console.log('PREDICTION RESULTS - TABLE VIEW');
        console.log('='.repeat(165));
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
            'Timestamp'.padEnd(20)
        ];
        console.log(headers.join('│'));
        console.log('-'.repeat(165));
        for (const prediction of predictions) {
            const indicators = prediction.technicalIndicators;
            const macdValue = indicators.macd?.macd?.toFixed(4) || 'N/A';
            const rsiValue = indicators.rsi?.toFixed(2) || 'N/A';
            const bbPosition = indicators.bollingerBands?.position || 'N/A';
            const volumeRatio = indicators.volume?.volumeRatio?.toFixed(2) || 'N/A';
            const timestamp = this.toBeiJingTime(prediction.timestamp);
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
                timestamp.padEnd(20)
            ];
            console.log(row.join('│'));
        }
        console.log('='.repeat(165));
        console.log(`Total Symbols: ${predictions.length}`);
        console.log('='.repeat(150));
    }
    static printCsvToConsole(predictions) {
        const csvContent = this.toCsvString(predictions);
        console.log('\n' + '='.repeat(80));
        console.log('PREDICTION RESULTS - CSV FORMAT');
        console.log('='.repeat(80));
        console.log(csvContent);
        console.log('='.repeat(80));
    }
    static escapeCsvField(field) {
        if (field.includes(',') || field.includes('\n') || field.includes('"')) {
            return `"${field.replace(/"/g, '""')}"`;
        }
        return field;
    }
    static generateSummary(predictions) {
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
exports.CSVExporter = CSVExporter;
//# sourceMappingURL=csvExporter.js.map