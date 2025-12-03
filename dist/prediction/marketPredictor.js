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
exports.MarketPredictor = void 0;
const indicatorCalculator_1 = require("../indicators/indicatorCalculator");
const deepseekAnalyzer_1 = require("../analysis/deepseekAnalyzer");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class MarketPredictor {
    constructor(binanceClient, config, deepSeekApiKey) {
        this.excludedPairs = new Set();
        this.binanceClient = binanceClient;
        this.config = config;
        this.deepSeekApiKey = deepSeekApiKey;
        if (deepSeekApiKey) {
            this.deepSeekAnalyzer = new deepseekAnalyzer_1.DeepSeekAnalyzer(deepSeekApiKey);
        }
        this.loadExcludedPairs();
    }
    loadExcludedPairs() {
        try {
            const possiblePaths = [
                path.join(__dirname, '../excluded_pairs.txt'),
                path.join(__dirname, '../../src/excluded_pairs.txt'),
                path.join(process.cwd(), 'src/excluded_pairs.txt'),
                path.join(process.cwd(), 'excluded_pairs.txt')
            ];
            let filePath = null;
            for (const p of possiblePaths) {
                if (fs.existsSync(p)) {
                    filePath = p;
                    break;
                }
            }
            if (filePath) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const pairs = content
                    .split('\n')
                    .map(pair => pair.trim())
                    .filter(pair => pair.length > 0);
                this.excludedPairs = new Set(pairs);
                console.log(`📋 已加载 ${this.excludedPairs.size} 个排除的交易对 (来自: ${filePath})`);
            }
            else {
                console.log('ℹ️  excluded_pairs.txt 文件不存在，将处理所有符合条件的交易对');
                console.log(`   已尝试的路径: ${possiblePaths.join(', ')}`);
            }
        }
        catch (error) {
            console.warn('⚠️  加载 excluded_pairs.txt 失败:', error);
        }
    }
    async predictMarket() {
        try {
            console.log('🚀 正在启动市场预测流程...');
            const filteredSymbols = await this.getFilteredSymbols();
            console.log(`✅ 找到 ${filteredSymbols.length} 个符合条件的交易对`);
            if (filteredSymbols.length === 0) {
                console.log('⚠️  没有交易对符合筛选条件');
                return [];
            }
            const predictedSymbols = [];
            const maxConcurrentWorkers = 5;
            const batchSize = Math.ceil(filteredSymbols.length / maxConcurrentWorkers);
            for (let i = 0; i < filteredSymbols.length; i += batchSize) {
                const batch = filteredSymbols.slice(i, i + batchSize);
                console.log(`🔄 处理第 ${Math.floor(i / batchSize) + 1} 批，共 ${batch.length} 个交易对...`);
                const batchPromises = batch.map(symbolData => this.processSymbol(symbolData));
                const batchResults = await Promise.allSettled(batchPromises);
                for (const result of batchResults) {
                    if (result.status === 'fulfilled' && result.value) {
                        predictedSymbols.push(result.value);
                    }
                    else if (result.status === 'rejected') {
                        console.error('❌ 处理交易对出错:', result.reason);
                    }
                }
            }
            predictedSymbols.sort((a, b) => {
                if (a.priceChangePercent24h !== b.priceChangePercent24h) {
                    return b.priceChangePercent24h - a.priceChangePercent24h;
                }
                return b.volume24h - a.volume24h;
            });
            return predictedSymbols;
        }
        catch (error) {
            console.error('Error in market prediction:', error);
            throw error;
        }
    }
    async getFilteredSymbols() {
        try {
            console.log('📊 正在获取所有交易对的24小时数据...');
            const allTickers = await this.binanceClient.getAll24hrTickers();
            console.log(`📈 共获得 ${allTickers.length} 个交易对的数据`);
            const filteredSymbols = allTickers.filter(ticker => {
                if (!ticker.symbol.endsWith('USDT')) {
                    return false;
                }
                if (this.excludedPairs.has(ticker.symbol)) {
                    console.log(`⏭️  跳过已排除的交易对: ${ticker.symbol}`);
                    return false;
                }
                if (ticker.quoteVolume < this.config.minVolumeThreshold) {
                    return false;
                }
                if (ticker.priceChangePercent < this.config.minPriceChangePercent) {
                    return false;
                }
                return true;
            });
            console.log(`🎯 筛选后得到 ${filteredSymbols.length} 个符合条件的交易对`);
            return filteredSymbols;
        }
        catch (error) {
            console.error('Error filtering symbols:', error);
            throw error;
        }
    }
    async processSymbol(symbolData) {
        try {
            const { symbol, price, quoteVolume, priceChangePercent } = symbolData;
            console.log(`⏳ 正在处理 ${symbol}...`);
            const klines = await this.binanceClient.getKlines(symbol, this.config.klineInterval, this.config.klineLimit);
            if (!klines || klines.length === 0) {
                console.warn(`⚠️  获取 ${symbol} 的K线数据失败`);
                return null;
            }
            let sumOpenInterestValue = 0;
            try {
                const openInterestData = await this.binanceClient.getOpenInterestStatistics({
                    symbol,
                    period: '1d',
                    limit: 1
                });
                const date = new Date(openInterestData[0].timestamp);
                const beijingDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
                const beijingTime = beijingDate.toISOString().slice(0, 19).replace('T', ' ');
                sumOpenInterestValue = parseFloat(openInterestData[0].sumOpenInterestValue);
            }
            catch (error) {
            }
            const indicators = indicatorCalculator_1.IndicatorCalculator.calculateAllIndicators(klines);
            const predictedSymbol = {
                symbol,
                currentPrice: price,
                volume24h: quoteVolume,
                priceChangePercent24h: priceChangePercent,
                sumOpenInterestValue,
                technicalIndicators: indicators,
                timestamp: Date.now()
            };
            if (this.config.deepSeekEnabled && this.deepSeekApiKey) {
                try {
                    const analysis = await this.getDeepSeekAnalysis(indicators, symbol);
                    predictedSymbol.prediction = analysis.prediction;
                    predictedSymbol.confidence = analysis.confidence;
                }
                catch (error) {
                    console.warn(`⚠️  获取 ${symbol} 的DeepSeek分析失败:`, error);
                }
            }
            return predictedSymbol;
        }
        catch (error) {
            console.error(`Error processing ${symbolData.symbol}:`, error);
            return null;
        }
    }
    async getDeepSeekAnalysis(indicators, symbol) {
        if (!this.deepSeekAnalyzer) {
            console.warn(`⚠️  ${symbol} - DeepSeek分析器未初始化，使用本地分析`);
            return this.generateLocalAnalysis(indicators);
        }
        try {
            const analysisData = {
                currentPrice: indicators.currentPrice || 0,
                macd: indicators.macd,
                volume: indicators.volume,
                rsi: indicators.rsi,
                ma: indicators.ma,
                bollingerBands: indicators.bollingerBands,
                priceData: indicators.priceData
            };
            const result = await this.deepSeekAnalyzer.analyzeTrend(analysisData, symbol);
            const signal = this.extractSignalFromAnalysis(result.analysis);
            const confidence = this.extractConfidenceFromAnalysis(result.analysis);
            console.log(`✅ ${symbol} - DeepSeek分析完成: ${signal} (置信度: ${confidence}%)`);
            return {
                prediction: signal,
                confidence,
                analysis: result.fullReport
            };
        }
        catch (error) {
            console.error(`❌ ${symbol} - DeepSeek API调用失败:`, error);
            return this.generateLocalAnalysis(indicators);
        }
    }
    generateLocalAnalysis(indicators) {
        let prediction = 'HOLD';
        let confidence = 50;
        let bullishScore = 0;
        let bearishScore = 0;
        if (indicators.macd?.histogram > 0 && indicators.macd?.macd > indicators.macd?.signal) {
            bullishScore += 2;
        }
        else if (indicators.macd?.histogram < 0 && indicators.macd?.macd < indicators.macd?.signal) {
            bearishScore += 2;
        }
        if (indicators.rsi >= 50 && indicators.rsi < 70) {
            bullishScore += 1;
        }
        else if (indicators.rsi >= 70) {
            bearishScore += 1;
        }
        else if (indicators.rsi < 50 && indicators.rsi > 30) {
            bearishScore += 1;
        }
        else if (indicators.rsi <= 30) {
            bullishScore += 1;
        }
        if (indicators.volume?.volumeTrend > 0) {
            bullishScore += 1;
        }
        else if (indicators.volume?.volumeTrend < 0) {
            bearishScore += 1;
        }
        if (bullishScore >= 3) {
            prediction = 'BUY';
            confidence = 65 + (bullishScore - 3) * 5;
        }
        else if (bearishScore >= 3) {
            prediction = 'SELL';
            confidence = 60 + (bearishScore - 3) * 5;
        }
        confidence = Math.min(100, Math.max(0, confidence));
        return { prediction, confidence };
    }
    extractSignalFromAnalysis(analysis) {
        const signals = ['强烈买入', '买入', '持有', '卖出', '强烈卖出', 'BUY', 'SELL', 'HOLD'];
        for (const signal of signals) {
            if (analysis.includes(signal)) {
                const signalMap = {
                    '强烈买入': 'BUY',
                    '买入': 'BUY',
                    '持有': 'HOLD',
                    '卖出': 'SELL',
                    '强烈卖出': 'SELL'
                };
                return signalMap[signal] || signal;
            }
        }
        return 'HOLD';
    }
    extractConfidenceFromAnalysis(analysis) {
        const confidenceMatch = analysis.match(/(?:置信度|confidence)[:\s]+(\d+)%?/i);
        if (confidenceMatch && confidenceMatch[1]) {
            return Math.min(100, Math.max(0, parseInt(confidenceMatch[1])));
        }
        const strongIndicators = (analysis.match(/(?:完美|强势|明确)/g) || []).length;
        const weakIndicators = (analysis.match(/(?:可能|可能存在|不确定)/g) || []).length;
        const baseConfidence = 60;
        const adjustment = (strongIndicators - weakIndicators) * 5;
        return Math.min(100, Math.max(0, baseConfidence + adjustment));
    }
}
exports.MarketPredictor = MarketPredictor;
//# sourceMappingURL=marketPredictor.js.map