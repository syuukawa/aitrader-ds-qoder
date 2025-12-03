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
     * 条件1: OI价值 > 50M USDT (sumOpenInterestValue)
     * 条件2: 24小时涨幅 > 5% (priceChangePercent)
     * 条件3: 并排除excluded_pairs.txt中的交易对
     */
    private async getFilteredSymbols(): Promise<PriceData[]> {
        try {
            console.log('📊 正在获取所有交易对的数据...');
            
            // 获取所有24小时行情数据
            const allTickers = await this.binanceClient.getAll24hrTickers();
            console.log(`📈 共获得 ${allTickers.length} 个交易对的数据`);
            
            // 第一步: 根据OI价值和24小时涨幅初步筛选
            console.log('🔍 第1步: 根据 OI价值 > 50M 和 24h涨幅 > 5% 进行初步筛选...');
            const candidateSymbols = allTickers.filter(ticker => {
                // 仅保留USDT交易对
                if (!ticker.symbol.endsWith('USDT')) {
                    return false;
                }
                
                // 条件2: 24小时涨幅 > 5%
                if (ticker.priceChangePercent < this.config.minPriceChangePercent) {
                    return false;
                }
                
                return true;
            });
            
            console.log(`✅ 初步筛选后得到 ${candidateSymbols.length} 个符合条件的交易对 (满足: USDT + 24h涨幅>5%)`);
            
            // 第二步: 获取OI数据并进一步筛选
            console.log('🔍 第2步: 获取OI数据，筛选 OI价值 > 50M 的交易对...');
            const oiMinThreshold = 50 * 1000000; // 50M USDT
            const filteredSymbols: PriceData[] = [];
            
            for (const ticker of candidateSymbols) {
                try {
                    // 获取该交易对的OI数据
                    const openInterestData = await this.binanceClient.getOpenInterestStatistics({
                        symbol: ticker.symbol,
                        period: '1d',
                        limit: 1
                    });
                    
                    if (openInterestData && openInterestData.length > 0) {
                        const sumOpenInterestValue = parseFloat(openInterestData[0].sumOpenInterestValue);
                        
                        // 条件1: OI价值 > 50M
                        if (sumOpenInterestValue > oiMinThreshold) {
                            // 将OI数据临时保存到ticker对象中（用于后续处理）
                            (ticker as any).sumOpenInterestValue = sumOpenInterestValue;
                            filteredSymbols.push(ticker);
                            console.log(`   ✓ ${ticker.symbol}: OI=${(sumOpenInterestValue / 1000000).toFixed(2)}M USDT, 涨幅=${ticker.priceChangePercent.toFixed(2)}%`);
                        }
                    }
                } catch (error) {
                    console.warn(`   ⚠️  ${ticker.symbol}: 获取OI数据失败，跳过`);
                    // 获取OI失败则跳过该交易对
                    continue;
                }
            }
            
            console.log(`🎯 OI筛选后得到 ${filteredSymbols.length} 个符合条件的交易对 (同时满足: OI>50M + 24h涨幅>5%)`);
            
            // 第三步: 排除黑名单中的交易对
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
        } catch (error) {
            console.error('Error filtering symbols:', error);
            throw error;
        }
    }

    /**
     * 处理单个交易对: 获取K线数据并计算技术指标
     * 注意: OI数据已在getFilteredSymbols中获取，不需要重复获取
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
            
            // 获取算法已经在getFilteredSymbols中执行，这里介取之前存储的OI值
            // 如果没有（比如直接调用processSymbol）则默认为0
            const sumOpenInterestValue = (symbolData as any).sumOpenInterestValue || 0;
            
            // 计算所有技术指标
            const indicators = IndicatorCalculator.calculateAllIndicators(klines);
            
            // 进行本地指标分析生成初始信号和置信度
            const localAnalysis = this.generateLocalAnalysis(indicators);
            
            const predictedSymbol: PredictedSymbol = {
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
            
            // 如果启用了DeepSeek分析，则尝试进行AI分析(可选增强)
            if (this.config.deepSeekEnabled && this.deepSeekApiKey) {
                try {
                    const analysis = await this.getDeepSeekAnalysis(indicators, symbol);
                    // 使用DeepSeek的分析结果覆盖本地分析(如果成功)
                    if (analysis.prediction) {
                        predictedSymbol.prediction = analysis.prediction;
                        predictedSymbol.confidence = analysis.confidence;
                    }
                } catch (error) {
                    console.warn(`⚠️  获取 ${symbol} 的DeepSeek分析失败，使用本地分析:`, error);
                    // 失败时保持本地分析结果
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
     * 本地分析方法 - 基于多指标的综合评分
     * 使用MACD、RSI、MA、布林带、成交量等指标综合判断
     */
    private generateLocalAnalysis(indicators: any): { prediction: string; confidence: number } {
        let bullishScore = 0;
        let bearishScore = 0;
        let scoreDetails: string[] = [];

        // ========== MACD 分析 (权重: 2) ==========
        if (indicators.macd) {
            const { macd, signal, histogram } = indicators.macd;
            if (histogram > 0 && macd > signal) {
                bullishScore += 2;
                scoreDetails.push('MACD: 金叉看涨 (+2)');
            } else if (histogram < 0 && macd < signal) {
                bearishScore += 2;
                scoreDetails.push('MACD: 死叉看跌 (+2)');
            } else if (histogram > 0) {
                bullishScore += 1;
                scoreDetails.push('MACD: 柱状体正值 (+1)');
            } else if (histogram < 0) {
                bearishScore += 1;
                scoreDetails.push('MACD: 柱状体负值 (+1)');
            }
        }

        // ========== RSI 分析 (权重: 1.5) ==========
        if (indicators.rsi !== undefined) {
            const rsi = indicators.rsi;
            if (rsi >= 70) {
                bearishScore += 1.5;
                scoreDetails.push(`RSI: 超买区(${rsi.toFixed(1)}) (-1.5)`);
            } else if (rsi >= 60 && rsi < 70) {
                bullishScore += 0.5;
                scoreDetails.push(`RSI: 强势区(${rsi.toFixed(1)}) (+0.5)`);
            } else if (rsi > 50 && rsi < 60) {
                bullishScore += 1;
                scoreDetails.push(`RSI: 温和看多(${rsi.toFixed(1)}) (+1)`);
            } else if (rsi > 40 && rsi <= 50) {
                bearishScore += 0.5;
                scoreDetails.push(`RSI: 略弱(${rsi.toFixed(1)}) (-0.5)`);
            } else if (rsi > 30 && rsi <= 40) {
                bearishScore += 1;
                scoreDetails.push(`RSI: 温和看空(${rsi.toFixed(1)}) (-1)`);
            } else if (rsi <= 30) {
                bullishScore += 1.5;
                scoreDetails.push(`RSI: 超卖反弹(${rsi.toFixed(1)}) (+1.5)`);
            }
        }

        // ========== 布林带分析 (权重: 1) ==========
        if (indicators.bollingerBands) {
            const { position } = indicators.bollingerBands;
            if (position === 'OVERBOUGHT') {
                bearishScore += 1;
                scoreDetails.push('BB: 触及上轨(-1)');
            } else if (position === 'OVERSOLD') {
                bullishScore += 1;
                scoreDetails.push('BB: 触及下轨(+1)');
            }
        }

        // ========== 移动平均线分析 (权重: 1.5) ==========
        if (indicators.ma) {
            const { ma5, ma10, ma20, ma50 } = indicators.ma;
            const price = indicators.currentPrice || 0;

            // 短期均线排列 (MA5, MA10, MA20)
            if (price > ma5 && ma5 > ma10 && ma10 > ma20) {
                bullishScore += 2;
                scoreDetails.push('MA: 完美多头排列(+2)');
            } else if (price < ma5 && ma5 < ma10 && ma10 < ma20) {
                bearishScore += 2;
                scoreDetails.push('MA: 完美空头排列(-2)');
            } else if (price > ma5 && price > ma10 && price > ma20) {
                bullishScore += 1;
                scoreDetails.push('MA: 价格在主要均线上方(+1)');
            } else if (price < ma5 && price < ma10 && price < ma20) {
                bearishScore += 1;
                scoreDetails.push('MA: 价格在主要均线下方(-1)');
            }

            // 中期趋势确认 (MA20 vs MA50)
            if (ma20 && ma50) {
                if (ma20 > ma50) {
                    bullishScore += 0.5;
                    scoreDetails.push('MA: 中期上升趋势(+0.5)');
                } else if (ma20 < ma50) {
                    bearishScore += 0.5;
                    scoreDetails.push('MA: 中期下降趋势(-0.5)');
                }
            }
        }

        // ========== 成交量分析 (权重: 1) ==========
        if (indicators.volume) {
            const { volumeRatio, volumeTrend } = indicators.volume;

            // 成交量比率
            if (volumeRatio > 1.5) {
                if (indicators.macd?.histogram > 0) {
                    bullishScore += 1.5;
                    scoreDetails.push('VOL: 放量+上涨(+1.5)');
                } else {
                    bearishScore += 1.5;
                    scoreDetails.push('VOL: 放量+下跌(-1.5)');
                }
            } else if (volumeRatio > 1.2) {
                bullishScore += 0.5;
                scoreDetails.push('VOL: 温和放量(+0.5)');
            } else if (volumeRatio < 0.7) {
                bearishScore += 0.5;
                scoreDetails.push('VOL: 成交量萎缩(-0.5)');
            }

            // 成交量趋势
            if (volumeTrend > 0.001) {
                bullishScore += 0.5;
                scoreDetails.push('VOL: 成交量上升趋势(+0.5)');
            } else if (volumeTrend < -0.001) {
                bearishScore += 0.5;
                scoreDetails.push('VOL: 成交量下降趋势(-0.5)');
            }
        }

        // ========== 综合评分生成信号 ==========
        let prediction = 'HOLD';
        let confidence = 50;

        // 计算净分
        const netScore = bullishScore - bearishScore;
        console.log(`   💡 ${scoreDetails.join(' | ')}`);
        console.log(`   📊 看涨分: ${bullishScore.toFixed(1)}, 看跌分: ${bearishScore.toFixed(1)}, 净分: ${netScore.toFixed(1)}`);

        // 根据净分和单项得分确定信号
        if (bullishScore >= 5) {
            prediction = 'STRONG_BUY';
            confidence = Math.min(95, 75 + bullishScore);
            scoreDetails.push(`→ 信号: 强烈买入(${confidence}%)`);
        } else if (bullishScore >= 3.5) {
            prediction = 'BUY';
            confidence = Math.min(90, 65 + bullishScore * 2);
            scoreDetails.push(`→ 信号: 买入(${confidence}%)`);
        } else if (bearishScore >= 5) {
            prediction = 'STRONG_SELL';
            confidence = Math.min(95, 75 + bearishScore);
            scoreDetails.push(`→ 信号: 强烈卖出(${confidence}%)`);
        } else if (bearishScore >= 3.5) {
            prediction = 'SELL';
            confidence = Math.min(90, 65 + bearishScore * 2);
            scoreDetails.push(`→ 信号: 卖出(${confidence}%)`);
        } else if (bullishScore > bearishScore + 1) {
            prediction = 'BUY';
            confidence = 50 + bullishScore * 5;
            scoreDetails.push(`→ 信号: 买入(${confidence}%)`);
        } else if (bearishScore > bullishScore + 1) {
            prediction = 'SELL';
            confidence = 50 + bearishScore * 5;
            scoreDetails.push(`→ 信号: 卖出(${confidence}%)`);
        } else {
            prediction = 'HOLD';
            confidence = 50 + Math.abs(netScore) * 2;
            scoreDetails.push(`→ 信号: 持有(${confidence}%)`);
        }

        // 确保置信度在0-100之间
        confidence = Math.min(100, Math.max(0, Math.round(confidence)));
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