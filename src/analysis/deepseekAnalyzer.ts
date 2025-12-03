// src/analysis/deepseekAnalyzer.ts
// DeepSeek AI 分析器 - 调用DeepSeek API进行深度技术分析

import { setGlobalDispatcher, ProxyAgent } from 'undici';
import * as dotenv from 'dotenv';

dotenv.config();

// 交易信号类型定义
type TradingSignalType = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';

// 技术指标接口定义
interface IndicatorAnalysis {
    currentPrice: number;
    macd: any;
    volume: any;
    rsi: number;
    ma: any;
    bollingerBands: any;
    priceData?: any;
}

// DeepSeek API 响应接口
interface DeepSeekResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

// 配置代理
const dispatcher = new ProxyAgent("http://127.0.0.1:7890");
setGlobalDispatcher(dispatcher);

export class DeepSeekAnalyzer {
    private apiKey: string;
    private baseURL: string = 'https://api.deepseek.com/v1/chat/completions';

    constructor(apiKey: string) {
        this.apiKey = apiKey;
    }

    /**
     * 进行完整的趋势分析
     * 包括总结输出和详细分析
     */
    async analyzeTrend(indicators: IndicatorAnalysis, symbol: string): Promise<{
        summary: string;
        analysis: string;
        fullReport: string;
    }> {
        try {
            // 生成总结性输出
            const summary = this.generateSummaryOutput(symbol, indicators);

            // 生成详细分析
            const analysis = await this.generateDetailedAnalysis(indicators, symbol);

            // 合并输出
            const fullReport = summary + '\n\n' + analysis;

            return {
                summary,
                analysis,
                fullReport
            };
        } catch (error) {
            console.error(`❌ DeepSeek趋势分析失败 (${symbol}):`, error);
            throw error;
        }
    }

    /**
     * 生成标准化的总结性输出
     */
    private generateSummaryOutput(symbol: string, indicators: IndicatorAnalysis): string {
        const { currentPrice } = indicators;

        // 基于技术指标生成简化信号
        const signal = this.generateSimpleSignal(indicators);
        const signalMap: Record<string, string> = {
            'STRONG_BUY': '强烈买入 🟢',
            'BUY': '买入 🟡',
            'HOLD': '持有 ⚪',
            'SELL': '卖出 🟠',
            'STRONG_SELL': '强烈卖出 🔴'
        };

        const signalText = signalMap[signal] || signal;

        return `${symbol} 技术面分析概览：
    
        ## 当前价格和初步评估
        - **当前价格**: ${currentPrice}
        - **技术信号**: ${signalText}`;
    }

    /**
     * 调用DeepSeek API进行详细分析
     */
    private async generateDetailedAnalysis(indicators: IndicatorAnalysis, symbol: string): Promise<string> {
        const prompt = this.buildAnalysisPrompt(indicators, symbol);

        // 是否输出Prompt用于调试
        if (process.env.DEEPSEEK_PROMPT_LOG === 'true') {
            console.log("📋 DeepSeek分析Prompt:", prompt);
        }

        try {
            const response = await fetch(this.baseURL, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'deepseek-chat',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.7,
                    max_tokens: 1500
                })
            });

            if (!response.ok) {
                throw new Error(`DeepSeek API错误: ${response.statusText}`);
            }

            const rawData: unknown = await response.json();

            // 类型检查和数据提取
            if (
                typeof rawData === 'object' &&
                rawData !== null &&
                'choices' in rawData
            ) {
                const data = rawData as DeepSeekResponse;
                return data.choices[0]?.message?.content || '❌ 分析失败';
            } else {
                throw new Error('❌ 无效的DeepSeek API响应结构');
            }

        } catch (error) {
            console.error('❌ DeepSeek API调用失败:', error);
            // 返回降级分析结果
            return this.getFallbackAnalysis(indicators, symbol);
        }
    }

    /**
     * 构建发送给DeepSeek的分析Prompt
     */
    private buildAnalysisPrompt(indicators: IndicatorAnalysis, symbol: string): string {
        const { macd, volume, currentPrice, rsi, ma, bollingerBands } = indicators;

        const signal = this.generateSimpleSignal(indicators);
        const signalMap: Record<string, string> = {
            'STRONG_BUY': '强烈买入',
            'BUY': '买入',
            'HOLD': '持有',
            'SELL': '卖出',
            'STRONG_SELL': '强烈卖出'
        };

        const signalText = signalMap[signal] || signal;

        return `
作为专业的量化交易分析师，请对以下加密货币 ${symbol} 进行深度技术分析：

## 📊 当前价格和初步评估
- **当前价格**: ${currentPrice}
- **自动技术信号**: ${signalText}

## 🔍 技术指标详情

### 📈 MACD 指标分析
- **MACD值**: ${macd?.macd?.toFixed(6) || 'N/A'}
- **信号线**: ${macd?.signal?.toFixed(6) || 'N/A'}
- **柱状图**: ${macd?.histogram?.toFixed(6) || 'N/A'}
${this.analyzeMACDStatus(macd)}

### 📊 移动平均线系统分析
- **MA5 (5日)**: ${ma?.ma5?.toFixed(8) || 'N/A'} ${this.getMAPosition(currentPrice, ma?.ma5)}
- **MA10 (10日)**: ${ma?.ma10?.toFixed(8) || 'N/A'} ${this.getMAPosition(currentPrice, ma?.ma10)}
- **MA20 (20日)**: ${ma?.ma20?.toFixed(8) || 'N/A'} ${this.getMAPosition(currentPrice, ma?.ma20)}
${ma?.ma50 ? `- **MA50 (50日)**: ${ma.ma50.toFixed(8)} ${this.getMAPosition(currentPrice, ma.ma50)}` : ''}

**均线排列分析**:
${this.analyzeMAArrangement(currentPrice, ma)}

### 📉 布林带指标分析
- **上轨(压力)**: ${bollingerBands?.upper?.toFixed(8) || 'N/A'}
- **中轨(趋势)**: ${bollingerBands?.middle?.toFixed(8) || 'N/A'}
- **下轨(支撑)**: ${bollingerBands?.lower?.toFixed(8) || 'N/A'}
- **带宽(波动率)**: ${bollingerBands?.bandwidth?.toFixed(4) || 'N/A'}%
- **价格位置**: ${bollingerBands?.position || 'N/A'}

${this.analyzeBollingerStatus(currentPrice, bollingerBands)}

### 📊 成交量分析
- **当前成交量**: ${volume?.currentVolume?.toFixed(2) || 'N/A'}
- **平均成交量**: ${volume?.averageVolume?.toFixed(2) || 'N/A'}
- **成交量比率**: ${volume?.volumeRatio?.toFixed(2) || 'N/A'}
- **成交量趋势**: ${volume?.volumeTrend?.toFixed(4) || 'N/A'}

${this.analyzeVolumeStatus(volume)}

### 🔄 RSI 相对强弱指数
- **RSI值**: ${rsi?.toFixed(2) || 'N/A'}
${this.analyzeRSIStatus(rsi)}

## 🎯 分析要求

请基于以上技术指标进行深度分析，主要关注以下几个方面：

1. **趋势分析**: 判断短期(1-3天)的主要趋势方向及强度
2. **信号验证**: 验证自动生成的"${signalText}"信号的准确性
3. **关键位置**: 识别关键的支撑位和阻力位
4. **风险评估**: 评估当前的风险收益比
5. **交易建议**: 给出具体的入场、止损、止盈建议

请用专业、客观的语言给出详细的分析报告，重点关注异常的技术面信号和潜在的风险因素。
        `;
    }

    /**
     * 生成简化的交易信号
     */
    private generateSimpleSignal(indicators: IndicatorAnalysis): TradingSignalType {
        const { macd, rsi, bollingerBands, volume } = indicators;

        let bullishScore = 0;
        let bearishScore = 0;

        // MACD 评分
        if (macd?.histogram > 0 && macd?.macd > macd?.signal) {
            bullishScore += 2;
        } else if (macd?.histogram < 0 && macd?.macd < macd?.signal) {
            bearishScore += 2;
        }

        // RSI 评分
        if (rsi >= 50 && rsi < 70) {
            bullishScore += 1;
        } else if (rsi >= 70) {
            bearishScore += 1; // 超买风险
        } else if (rsi < 50 && rsi > 30) {
            bearishScore += 1;
        } else if (rsi <= 30) {
            bullishScore += 1; // 超卖反弹
        }

        // 布林带评分
        if (bollingerBands?.position === 'OVERSOLD') {
            bullishScore += 1;
        } else if (bollingerBands?.position === 'OVERBOUGHT') {
            bearishScore += 1;
        }

        // 成交量评分
        if (volume?.volumeRatio > 1.2) {
            if (indicators.macd?.histogram > 0) {
                bullishScore += 1;
            } else {
                bearishScore += 1;
            }
        }

        // 综合评分生成信号
        if (bullishScore >= 4) return 'STRONG_BUY';
        if (bullishScore > bearishScore + 1) return 'BUY';
        if (bearishScore > bullishScore + 1) return 'SELL';
        if (bearishScore >= 4) return 'STRONG_SELL';
        return 'HOLD';
    }

    // ============ 辅助分析方法 ============

    /**
     * 分析MACD状态
     */
    private analyzeMACDStatus(macd: any): string {
        if (!macd) return '';
        const status = macd.macd > macd.signal ? '🟢 看涨金叉' : macd.macd < macd.signal ? '🔴 看跌死叉' : '⚪ 中性整理';
        const trend = macd.histogram > 0 ? '🟢 多头动能增强' : '🔴 空头动能增强';
        return `**当前状态**: ${status}
**柱状图趋势**: ${trend}`;
    }

    /**
     * 获取价格相对于移动平均线的位置
     */
    private getMAPosition(currentPrice: number, maValue: number | undefined): string {
        if (!maValue) return '';
        const diffPercent = ((currentPrice - maValue) / maValue) * 100;
        if (diffPercent > 2) return '🟢 (价格上方)';
        if (diffPercent > 0) return '🟡 (略上方)';
        if (diffPercent > -2) return '🟠 (略下方)';
        return '🔴 (价格下方)';
    }

    /**
     * 分析均线排列
     */
    private analyzeMAArrangement(currentPrice: number, ma: any): string {
        if (!ma) return '⚪ **数据不足**: 无法进行均线排列分析';

        const { ma5, ma10, ma20, ma50 } = ma;

        // 检查多头排列
        if (currentPrice > ma5 && ma5 > ma10 && ma10 > ma20) {
            if (ma50 && ma20 > ma50) {
                return '🟢 **完美多头排列**: 价格 > MA5 > MA10 > MA20 > MA50，趋势强劲';
            }
            return '🟢 **强势多头排列**: 价格 > MA5 > MA10 > MA20，短期均线呈多头排列';
        }

        // 检查空头排列
        if (currentPrice < ma5 && ma5 < ma10 && ma10 < ma20) {
            if (ma50 && ma20 < ma50) {
                return '🔴 **完美空头排列**: 价格 < MA5 < MA10 < MA20 < MA50，趋势疲弱';
            }
            return '🔴 **强势空头排列**: 价格 < MA5 < MA10 < MA20，短期均线呈空头排列';
        }

        if (currentPrice > ma5 && currentPrice > ma10) {
            return '🟡 **偏多震荡**: 价格在短期均线之上，但均线排列不完整';
        }

        if (currentPrice < ma5 && currentPrice < ma10) {
            return '🟠 **偏空震荡**: 价格在短期均线之下，但均线排列不完整';
        }

        return '⚪ **均线粘合**: 各周期均线接近，市场处于整理状态';
    }

    /**
     * 分析布林带状态
     */
    private analyzeBollingerStatus(currentPrice: number, bb: any): string {
        if (!bb) return '';

        const { position, bandwidth } = bb;

        let status = '';

        if (position === 'OVERBOUGHT') {
            status = '🔴 **价格触及上轨**: 短期可能超买，注意回调风险';
        } else if (position === 'OVERSOLD') {
            status = '🟢 **价格触及下轨**: 短期可能超卖，存在反弹机会';
        } else if (currentPrice > bb.middle) {
            status = '🟡 **价格在中轨上方**: 偏多格局';
        } else {
            status = '🟠 **价格在中轨下方**: 偏空格局';
        }

        if (bandwidth < 3) {
            status += '，📉 **带宽极度收缩**: 波动率创近期新低，预示即将出现大幅波动';
        } else if (bandwidth > 10) {
            status += '，📈 **带宽大幅扩张**: 市场波动剧烈，趋势行情可能延续';
        }

        return `**布林带状态**: ${status}`;
    }

    /**
     * 分析成交量状态
     */
    private analyzeVolumeStatus(volume: any): string {
        if (!volume) return '';

        const { volumeRatio, volumeTrend } = volume;

        if (volumeRatio > 1.5) {
            return '**成交量状态**: 📈 **放量交易**: 成交量大幅放大，市场热度高';
        } else if (volumeRatio > 1.2) {
            return '**成交量状态**: 📊 **温和放量**: 成交量温和增加，买卖力量增强';
        } else if (volumeRatio < 0.7) {
            return '**成交量状态**: 📉 **萎缩成交**: 成交量大幅萎缩，市场热度低';
        } else {
            return '**成交量状态**: ⚪ **正常成交**: 成交量处于正常水平';
        }
    }

    /**
     * 分析RSI状态
     */
    private analyzeRSIStatus(rsi: number): string {
        if (rsi >= 70) {
            return `**RSI状态**: 🔴 **超买区域 (${rsi.toFixed(1)})** - RSI高于70，市场过热，短期回调风险大`;
        } else if (rsi >= 60) {
            return `**RSI状态**: 🟡 **强势区域 (${rsi.toFixed(1)})** - RSI在60-70，多头占优但接近超买`;
        } else if (rsi >= 40) {
            return `**RSI状态**: ⚪ **平衡区域 (${rsi.toFixed(1)})** - RSI在40-60，多空力量相对平衡`;
        } else if (rsi >= 30) {
            return `**RSI状态**: 🟠 **弱势区域 (${rsi.toFixed(1)})** - RSI在30-40，空头占优但接近超卖`;
        } else {
            return `**RSI状态**: 🟢 **超卖区域 (${rsi.toFixed(1)})** - RSI低于30，市场超卖，存在反弹机会`;
        }
    }

    /**
     * 降级分析 - 当DeepSeek API调用失败时使用
     */
    private getFallbackAnalysis(indicators: IndicatorAnalysis, symbol: string): string {
        const signal = this.generateSimpleSignal(indicators);
        const signalMap: Record<string, string> = {
            'STRONG_BUY': '强烈买入 🟢',
            'BUY': '买入 🟡',
            'HOLD': '持有 ⚪',
            'SELL': '卖出 🟠',
            'STRONG_SELL': '强烈卖出 🔴'
        };

        return `
## ${symbol} 降级分析报告

由于DeepSeek API暂时不可用，以下为基于技术指标的降级分析：

### 综合评估
**交易信号**: ${signalMap[signal] || signal}

### 技术面评价
${this.analyzeMACDStatus(indicators.macd)}

${this.analyzeMAArrangement(indicators.currentPrice, indicators.ma)}

${this.analyzeBollingerStatus(indicators.currentPrice, indicators.bollingerBands)}

${this.analyzeVolumeStatus(indicators.volume)}

${this.analyzeRSIStatus(indicators.rsi)}

**备注**: 本分析基于技术指标自动生成，建议结合其他信息进行综合判断。
        `;
    }
}
