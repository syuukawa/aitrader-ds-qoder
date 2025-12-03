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
            console.log('📊 正在获取所有交易对的数据...');
            const allTickers = await this.binanceClient.getAll24hrTickers();
            console.log(`📈 共获得 ${allTickers.length} 个交易对的数据`);
            console.log('🔍 第1步: 根据 OI价值 > 50M 和 24h涨幅 > 5% 进行初步筛选...');
            const candidateSymbols = allTickers.filter(ticker => {
                if (!ticker.symbol.endsWith('USDT')) {
                    return false;
                }
                if (ticker.priceChangePercent < this.config.minPriceChangePercent) {
                    return false;
                }
                return true;
            });
            console.log(`✅ 初步筛选后得到 ${candidateSymbols.length} 个符合条件的交易对 (满足: USDT + 24h涨幅>5%)`);
            console.log('🔍 第2步: 获取OI数据，筛选 OI价值 > 50M 的交易对...');
            const oiMinThreshold = 50 * 1000000;
            const filteredSymbols = [];
            for (const ticker of candidateSymbols) {
                try {
                    const openInterestData = await this.binanceClient.getOpenInterestStatistics({
                        symbol: ticker.symbol,
                        period: '1d',
                        limit: 1
                    });
                    if (openInterestData && openInterestData.length > 0) {
                        const sumOpenInterestValue = parseFloat(openInterestData[0].sumOpenInterestValue);
                        if (sumOpenInterestValue > oiMinThreshold) {
                            ticker.sumOpenInterestValue = sumOpenInterestValue;
                            filteredSymbols.push(ticker);
                            console.log(`   ✓ ${ticker.symbol}: OI=${(sumOpenInterestValue / 1000000).toFixed(2)}M USDT, 涨幅=${ticker.priceChangePercent.toFixed(2)}%`);
                        }
                    }
                }
                catch (error) {
                    console.warn(`   ⚠️  ${ticker.symbol}: 获取OI数据失败，跳过`);
                    continue;
                }
            }
            console.log(`🎯 OI筛选后得到 ${filteredSymbols.length} 个符合条件的交易对 (同时满足: OI>50M + 24h涨幅>5%)`);
            console.log('🔍 第3步: 排除黑名单中的交易对...');
            const finalFilteredSymbols = filteredSymbols.filter(ticker => {
                if (this.excludedPairs.has(ticker.symbol)) {
                    console.log(`   ⏭️  跳过已排除的交易对: ${ticker.symbol}`);
                    return false;
                }
                return true;
            });
            console.log(`✅ 最终筛选后得到 ${finalFilteredSymbols.length} 个符合条件的交易对`);
            return finalFilteredSymbols;
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
            const sumOpenInterestValue = symbolData.sumOpenInterestValue || 0;
            const indicators = indicatorCalculator_1.IndicatorCalculator.calculateAllIndicators(klines);
            const localAnalysis = this.generateLocalAnalysis(indicators);
            const predictedSymbol = {
                symbol,
                currentPrice: price,
                volume24h: quoteVolume,
                priceChangePercent24h: priceChangePercent,
                sumOpenInterestValue,
                technicalIndicators: indicators,
                prediction: localAnalysis.prediction,
                confidence: localAnalysis.confidence,
                timestamp: Date.now()
            };
            if (this.config.deepSeekEnabled && this.deepSeekApiKey) {
                try {
                    const analysis = await this.getDeepSeekAnalysis(indicators, symbol);
                    if (analysis.prediction) {
                        predictedSymbol.prediction = analysis.prediction;
                        predictedSymbol.confidence = analysis.confidence;
                    }
                }
                catch (error) {
                    console.warn(`⚠️  获取 ${symbol} 的DeepSeek分析失败，使用本地分析:`, error);
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
        let bullishScore = 0;
        let bearishScore = 0;
        let scoreDetails = [];
        if (indicators.macd) {
            const { macd, signal, histogram } = indicators.macd;
            if (histogram > 0 && macd > signal) {
                bullishScore += 2;
                scoreDetails.push('MACD: 金叉看涨 (+2)');
            }
            else if (histogram < 0 && macd < signal) {
                bearishScore += 2;
                scoreDetails.push('MACD: 死叉看跌 (+2)');
            }
            else if (histogram > 0) {
                bullishScore += 1;
                scoreDetails.push('MACD: 柱状体正值 (+1)');
            }
            else if (histogram < 0) {
                bearishScore += 1;
                scoreDetails.push('MACD: 柱状体负值 (+1)');
            }
        }
        if (indicators.rsi !== undefined) {
            const rsi = indicators.rsi;
            if (rsi >= 70) {
                bearishScore += 1.5;
                scoreDetails.push(`RSI: 超买区(${rsi.toFixed(1)}) (-1.5)`);
            }
            else if (rsi >= 60 && rsi < 70) {
                bullishScore += 0.5;
                scoreDetails.push(`RSI: 强势区(${rsi.toFixed(1)}) (+0.5)`);
            }
            else if (rsi > 50 && rsi < 60) {
                bullishScore += 1;
                scoreDetails.push(`RSI: 温和看多(${rsi.toFixed(1)}) (+1)`);
            }
            else if (rsi > 40 && rsi <= 50) {
                bearishScore += 0.5;
                scoreDetails.push(`RSI: 略弱(${rsi.toFixed(1)}) (-0.5)`);
            }
            else if (rsi > 30 && rsi <= 40) {
                bearishScore += 1;
                scoreDetails.push(`RSI: 温和看空(${rsi.toFixed(1)}) (-1)`);
            }
            else if (rsi <= 30) {
                bullishScore += 1.5;
                scoreDetails.push(`RSI: 超卖反弹(${rsi.toFixed(1)}) (+1.5)`);
            }
        }
        if (indicators.bollingerBands) {
            const { position } = indicators.bollingerBands;
            if (position === 'OVERBOUGHT') {
                bearishScore += 1;
                scoreDetails.push('BB: 触及上轨(-1)');
            }
            else if (position === 'OVERSOLD') {
                bullishScore += 1;
                scoreDetails.push('BB: 触及下轨(+1)');
            }
        }
        if (indicators.ma) {
            const { ma5, ma10, ma20, ma50 } = indicators.ma;
            const price = indicators.currentPrice || 0;
            if (price > ma5 && ma5 > ma10 && ma10 > ma20) {
                bullishScore += 2;
                scoreDetails.push('MA: 完美多头排列(+2)');
            }
            else if (price < ma5 && ma5 < ma10 && ma10 < ma20) {
                bearishScore += 2;
                scoreDetails.push('MA: 完美空头排列(-2)');
            }
            else if (price > ma5 && price > ma10 && price > ma20) {
                bullishScore += 1;
                scoreDetails.push('MA: 价格在主要均线上方(+1)');
            }
            else if (price < ma5 && price < ma10 && price < ma20) {
                bearishScore += 1;
                scoreDetails.push('MA: 价格在主要均线下方(-1)');
            }
            if (ma20 && ma50) {
                if (ma20 > ma50) {
                    bullishScore += 0.5;
                    scoreDetails.push('MA: 中期上升趋势(+0.5)');
                }
                else if (ma20 < ma50) {
                    bearishScore += 0.5;
                    scoreDetails.push('MA: 中期下降趋势(-0.5)');
                }
            }
        }
        if (indicators.volume) {
            const { volumeRatio, volumeTrend } = indicators.volume;
            if (volumeRatio > 1.5) {
                if (indicators.macd?.histogram > 0) {
                    bullishScore += 1.5;
                    scoreDetails.push('VOL: 放量+上涨(+1.5)');
                }
                else {
                    bearishScore += 1.5;
                    scoreDetails.push('VOL: 放量+下跌(-1.5)');
                }
            }
            else if (volumeRatio > 1.2) {
                bullishScore += 0.5;
                scoreDetails.push('VOL: 温和放量(+0.5)');
            }
            else if (volumeRatio < 0.7) {
                bearishScore += 0.5;
                scoreDetails.push('VOL: 成交量萎缩(-0.5)');
            }
            if (volumeTrend > 0.001) {
                bullishScore += 0.5;
                scoreDetails.push('VOL: 成交量上升趋势(+0.5)');
            }
            else if (volumeTrend < -0.001) {
                bearishScore += 0.5;
                scoreDetails.push('VOL: 成交量下降趋势(-0.5)');
            }
        }
        let prediction = 'HOLD';
        let confidence = 50;
        const netScore = bullishScore - bearishScore;
        console.log(`   💡 ${scoreDetails.join(' | ')}`);
        console.log(`   📊 看涨分: ${bullishScore.toFixed(1)}, 看跌分: ${bearishScore.toFixed(1)}, 净分: ${netScore.toFixed(1)}`);
        if (bullishScore >= 5) {
            prediction = 'STRONG_BUY';
            confidence = Math.min(95, 75 + bullishScore);
            scoreDetails.push(`→ 信号: 强烈买入(${confidence}%)`);
        }
        else if (bullishScore >= 3.5) {
            prediction = 'BUY';
            confidence = Math.min(90, 65 + bullishScore * 2);
            scoreDetails.push(`→ 信号: 买入(${confidence}%)`);
        }
        else if (bearishScore >= 5) {
            prediction = 'STRONG_SELL';
            confidence = Math.min(95, 75 + bearishScore);
            scoreDetails.push(`→ 信号: 强烈卖出(${confidence}%)`);
        }
        else if (bearishScore >= 3.5) {
            prediction = 'SELL';
            confidence = Math.min(90, 65 + bearishScore * 2);
            scoreDetails.push(`→ 信号: 卖出(${confidence}%)`);
        }
        else if (bullishScore > bearishScore + 1) {
            prediction = 'BUY';
            confidence = 50 + bullishScore * 5;
            scoreDetails.push(`→ 信号: 买入(${confidence}%)`);
        }
        else if (bearishScore > bullishScore + 1) {
            prediction = 'SELL';
            confidence = 50 + bearishScore * 5;
            scoreDetails.push(`→ 信号: 卖出(${confidence}%)`);
        }
        else {
            prediction = 'HOLD';
            confidence = 50 + Math.abs(netScore) * 2;
            scoreDetails.push(`→ 信号: 持有(${confidence}%)`);
        }
        confidence = Math.min(100, Math.max(0, Math.round(confidence)));
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