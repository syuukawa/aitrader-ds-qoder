// src/prediction/marketPredictor.ts
// 市场预测器 - 负责获取市场数据、计算技术指标、生成交易信号
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import { BinanceClient } from '../binance/client';
import { IndicatorCalculator } from '../indicators/indicatorCalculator';
import { PredictionConfig, PredictedSymbol } from './types';
import { OpenInterestData, PriceData } from '../binance/types';
import { DeepSeekAnalyzer } from '../analysis/deepseekAnalyzer';
import * as fs from 'fs';
import * as path from 'path';

// 市场预测类
export class MarketPredictor {
    private binanceClient: BinanceClient; // Binance API客户端
    private config: PredictionConfig; // 预测配置参数
    private deepSeekApiKey?: string; // DeepSeek API密钥
    private deepSeekAnalyzer?: DeepSeekAnalyzer; // DeepSeek AI分析器
    private excludedPairs: Set<string> = new Set(); // 排除的交易对集合

    constructor(
        binanceClient: BinanceClient,
        config: PredictionConfig,
        deepSeekApiKey?: string
    ) {
        this.binanceClient = binanceClient;
        this.config = config;
        this.deepSeekApiKey = deepSeekApiKey;
        // 如果提供了DeepSeek API密钥，则初始化分析器
        if (deepSeekApiKey) {
            this.deepSeekAnalyzer = new DeepSeekAnalyzer(deepSeekApiKey);
        }
        // 加载排除的交易对列表
        this.loadExcludedPairs();
    }

    /**
     * 从excluded_pairs.txt文件加载排除的交易对列表
     */
    private loadExcludedPairs(): void {
        try {
            // 尝试多个可能的路径位置
            const possiblePaths = [
                path.join(__dirname, '../excluded_pairs.txt'),  // dist/prediction/../excluded_pairs.txt
                path.join(__dirname, '../../src/excluded_pairs.txt'),  // 源代码位置
                path.join(process.cwd(), 'src/excluded_pairs.txt'),  // 工作目录下的src文件夹
                path.join(process.cwd(), 'excluded_pairs.txt')  // 工作目录根目录
            ];

            let filePath: string | null = null;
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
            } else {
                console.log('ℹ️  excluded_pairs.txt 文件不存在，将处理所有符合条件的交易对');
                console.log(`   已尝试的路径: ${possiblePaths.join(', ')}`);
            }
        } catch (error) {
            console.warn('⚠️  加载 excluded_pairs.txt 失败:', error);
        }
    }

    /**
     * 主要预测工作流:
     * 1. 从Binance获取24小时交易量数据
     * 2. 根据涨幅和成交量条件筛选交易对
     * 3. 获取已筛选交易对的K线数据
     * 4. 计算技术指标 (MACD, RSI, 布林带等)
     * 5. (可选) 获取DeepSeek AI分析
     */
    async predictMarket(): Promise<PredictedSymbol[]> {
        try {
            console.log('🚀 正在启动市场预测流程...');
            
            // 第1&2步: 获取并筛选高成交量交易对
            const filteredSymbols = await this.getFilteredSymbols();
            console.log(`✅ 找到 ${filteredSymbols.length} 个符合条件的交易对`);
            
            if (filteredSymbols.length === 0) {
                console.log('⚠️  没有交易对符合筛选条件');
                return [];
            }
            
            // 第3&4步: 获取K线数据并计算指标
            const predictedSymbols: PredictedSymbol[] = [];
            
            // 使用并发处理以提高效率
            const maxConcurrentWorkers = 5; // 限制并发工作线程数，防止资源耗尽
            const batchSize = Math.ceil(filteredSymbols.length / maxConcurrentWorkers);
            
            // 分批处理交易对
            for (let i = 0; i < filteredSymbols.length; i += batchSize) {
                const batch = filteredSymbols.slice(i, i + batchSize);
                console.log(`🔄 处理第 ${Math.floor(i / batchSize) + 1} 批，共 ${batch.length} 个交易对...`);
                
                const batchPromises = batch.map(symbolData => 
                    this.processSymbol(symbolData)
                );
                
                const batchResults = await Promise.allSettled(batchPromises);
                
                for (const result of batchResults) {
                    if (result.status === 'fulfilled' && result.value) {
                        predictedSymbols.push(result.value);
                    } else if (result.status === 'rejected') {
                        console.error('❌ 处理交易对出错:', result.reason);
                    }
                }
            }
            
            // 排序: 先按24小时涨幅倒序，再按成交量倒序
            predictedSymbols.sort((a, b) => {
                // 首先按价格涨幅排序 (高值优先)
                if (a.priceChangePercent24h !== b.priceChangePercent24h) {
                    return b.priceChangePercent24h - a.priceChangePercent24h;
                }
                // 如果涨幅相同，则按成交量排序 (高值优先)
                return b.volume24h - a.volume24h;
            });
            
            return predictedSymbols;
        } catch (error) {
            console.error('Error in market prediction:', error);
            throw error;
        }
    }

    /**
     * 获取并筛选满足条件的交易对
     * 条件: 24小时涨幅 > 5%, 成交额USDT > 50M USDT
     * 并排除excluded_pairs.txt中的交易对
     */
    private async getFilteredSymbols(): Promise<PriceData[]> {
        try {
            console.log('📊 正在获取所有交易对的24小时数据...');
            
            // 获取所有24小时行情数据
            const allTickers = await this.binanceClient.getAll24hrTickers();
            
            console.log(`📈 共获得 ${allTickers.length} 个交易对的数据`);
            


            // 根据条件筛选交易对
            const filteredSymbols = allTickers.filter(ticker => {
                // 仅保留USDT交易对
                if (!ticker.symbol.endsWith('USDT')) {
                    return false;
                }
                
                // 排除在黑名单中的交易对
                if (this.excludedPairs.has(ticker.symbol)) {
                    console.log(`⏭️  跳过已排除的交易对: ${ticker.symbol}`);
                    return false;
                }
                
                // 按成交量筛选
                if (ticker.quoteVolume < this.config.minVolumeThreshold) {
                    return false;
                }
                
                // 按24小时涨幅筛选
                if (ticker.priceChangePercent < this.config.minPriceChangePercent) {
                    return false;
                }
                
                // console.log(' ticker.quoteVolume', ticker.quoteVolume);
                // console.log(' Filtering symbols based on conditions...', this.config.minVolumeThreshold);

                // console.log(`ticker.priceChangePercent: ${ticker.priceChangePercent}`);
                // console.log(`Minimum Volume Threshold: ${this.config.minPriceChangePercent}`);
                

                return true;
            });
            
            console.log(`🎯 筛选后得到 ${filteredSymbols.length} 个符合条件的交易对`);
            return filteredSymbols;
        } catch (error) {
            console.error('Error filtering symbols:', error);
            throw error;
        }
    }

    /**
     * 处理单个交易对: 获取K线数据并计算技术指标
     */
    private async processSymbol(symbolData: PriceData): Promise<PredictedSymbol | null> {
        try {
            const { symbol, price, quoteVolume, priceChangePercent } = symbolData;
            
            console.log(`⏳ 正在处理 ${symbol}...`);
            
            // 获取K线数据
            const klines = await this.binanceClient.getKlines(
                symbol,
                this.config.klineInterval,
                this.config.klineLimit
            );
            
            if (!klines || klines.length === 0) {
                console.warn(`⚠️  获取 ${symbol} 的K线数据失败`);
                return null;
            }
            
            // TODO: 暂时没用到
            // 获取持仓数据 (可选，如果出错则跳过)
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
                // console.log(`Received open interest data for ${symbol}: ${JSON.stringify({...openInterestData[0], timestamp: beijingTime})}`);
                sumOpenInterestValue = parseFloat(openInterestData[0].sumOpenInterestValue);
            } catch (error) {
                // 持仓数据获取失败不影响交易信号生成
                // console.warn(`Failed to fetch open interest for ${symbol}:`, error);
            }
            
            // 计算所有技术指标
            const indicators = IndicatorCalculator.calculateAllIndicators(klines);
            
            const predictedSymbol: PredictedSymbol = {
                symbol,
                currentPrice: price,
                volume24h: quoteVolume,
                priceChangePercent24h: priceChangePercent,
                sumOpenInterestValue,
                technicalIndicators: indicators,
                timestamp: Date.now()
            };
            
            // 如果启用了DeepSeek分析，则进行AI分析
            if (this.config.deepSeekEnabled && this.deepSeekApiKey) {
                try {
                    const analysis = await this.getDeepSeekAnalysis(indicators, symbol);
                    predictedSymbol.prediction = analysis.prediction;
                    predictedSymbol.confidence = analysis.confidence;
                } catch (error) {
                    console.warn(`⚠️  获取 ${symbol} 的DeepSeek分析失败:`, error);
                }
            }
            
            return predictedSymbol;
        } catch (error) {
            console.error(`Error processing ${symbolData.symbol}:`, error);
            return null;
        }
    }

    /**
     * 获取DeepSeek AI分析
     * 调用DeepSeek API进行深度技术分析，生成交易信号和分析报告
     */
    private async getDeepSeekAnalysis(indicators: any, symbol: string): Promise<{ prediction: string; confidence: number; analysis?: string }> {
        // 如果未初始化分析器，使用降级方案
        if (!this.deepSeekAnalyzer) {
            console.warn(`⚠️  ${symbol} - DeepSeek分析器未初始化，使用本地分析`);
            return this.generateLocalAnalysis(indicators);
        }

        try {
            // 构建发送给DeepSeek的指标数据
            const analysisData = {
                currentPrice: indicators.currentPrice || 0,
                macd: indicators.macd,
                volume: indicators.volume,
                rsi: indicators.rsi,
                ma: indicators.ma,
                bollingerBands: indicators.bollingerBands,
                priceData: indicators.priceData
            };

            // 调用DeepSeek进行分析
            const result = await this.deepSeekAnalyzer.analyzeTrend(analysisData, symbol);

            // 从分析结果中提取交易信号
            const signal = this.extractSignalFromAnalysis(result.analysis);
            const confidence = this.extractConfidenceFromAnalysis(result.analysis);

            console.log(`✅ ${symbol} - DeepSeek分析完成: ${signal} (置信度: ${confidence}%)`);

            return {
                prediction: signal,
                confidence,
                analysis: result.fullReport
            };
        } catch (error) {
            console.error(`❌ ${symbol} - DeepSeek API调用失败:`, error);
            // API调用失败，回退到本地分析
            return this.generateLocalAnalysis(indicators);
        }
    }

    /**
     * 本地分析方法 (降级方案)
     * 当DeepSeek API不可用时使用
     */
    private generateLocalAnalysis(indicators: any): { prediction: string; confidence: number } {
        let prediction = 'HOLD';
        let confidence = 50;

        // 基于指标的启发式交易信号生成
        let bullishScore = 0;
        let bearishScore = 0;

        // MACD 评分
        if (indicators.macd?.histogram > 0 && indicators.macd?.macd > indicators.macd?.signal) {
            bullishScore += 2;
        } else if (indicators.macd?.histogram < 0 && indicators.macd?.macd < indicators.macd?.signal) {
            bearishScore += 2;
        }

        // RSI 评分
        if (indicators.rsi >= 50 && indicators.rsi < 70) {
            bullishScore += 1;
        } else if (indicators.rsi >= 70) {
            bearishScore += 1; // 超买风险
        } else if (indicators.rsi < 50 && indicators.rsi > 30) {
            bearishScore += 1;
        } else if (indicators.rsi <= 30) {
            bullishScore += 1; // 超卖反弹
        }

        // 成交量趋势
        if (indicators.volume?.volumeTrend > 0) {
            bullishScore += 1;
        } else if (indicators.volume?.volumeTrend < 0) {
            bearishScore += 1;
        }

        // 综合评分生成信号
        if (bullishScore >= 3) {
            prediction = 'BUY';
            confidence = 65 + (bullishScore - 3) * 5;
        } else if (bearishScore >= 3) {
            prediction = 'SELL';
            confidence = 60 + (bearishScore - 3) * 5;
        }

        confidence = Math.min(100, Math.max(0, confidence));
        return { prediction, confidence };
    }

    /**
     * 从DeepSeek分析结果中提取交易信号
     */
    private extractSignalFromAnalysis(analysis: string): string {
        // 查找分析结果中的信号关键词
        const signals = ['强烈买入', '买入', '持有', '卖出', '强烈卖出', 'BUY', 'SELL', 'HOLD'];

        for (const signal of signals) {
            if (analysis.includes(signal)) {
                // 映射中文信号到英文
                const signalMap: Record<string, string> = {
                    '强烈买入': 'BUY',
                    '买入': 'BUY',
                    '持有': 'HOLD',
                    '卖出': 'SELL',
                    '强烈卖出': 'SELL'
                };
                return signalMap[signal] || signal;
            }
        }

        return 'HOLD'; // 默认信号
    }

    /**
     * 从DeepSeek分析结果中提取置信度
     */
    private extractConfidenceFromAnalysis(analysis: string): number {
        // 查找分析结果中的置信度信息
        const confidenceMatch = analysis.match(/(?:置信度|confidence)[:\s]+(\d+)%?/i);
        if (confidenceMatch && confidenceMatch[1]) {
            return Math.min(100, Math.max(0, parseInt(confidenceMatch[1])));
        }

        // 如果未找到明确的置信度，根据分析内容推估
        const strongIndicators = (analysis.match(/(?:完美|强势|明确)/g) || []).length;
        const weakIndicators = (analysis.match(/(?:可能|可能存在|不确定)/g) || []).length;

        const baseConfidence = 60;
        const adjustment = (strongIndicators - weakIndicators) * 5;
        return Math.min(100, Math.max(0, baseConfidence + adjustment));
    }
}