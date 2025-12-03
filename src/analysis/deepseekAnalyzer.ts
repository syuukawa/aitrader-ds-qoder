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
     * 优化版本：包含全面的投资建议生成
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
        const riskLevel = this.assessRiskLevel(indicators);
        const supportResistance = this.calculateSupportResistance(indicators);
        const volumeAnalysis = this.analyzeVolumeQuality(volume, indicators.priceData);

        return `
作为专业的量化交易分析师，请对以下加密货币 ${symbol} 进行全面的技术分析并提供详细的投资建议：

## 📊 当前价格和市场概览
- **当前价格**: $${currentPrice.toFixed(8)}
- **自动技术信号**: ${signalText}
- **风险等级**: ${riskLevel}
- **成交量质量**: ${volumeAnalysis}

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
- **上轨(压力)**: $${bollingerBands?.upper?.toFixed(8) || 'N/A'}
- **中轨(趋势)**: $${bollingerBands?.middle?.toFixed(8) || 'N/A'}
- **下轨(支撑)**: $${bollingerBands?.lower?.toFixed(8) || 'N/A'}
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

## 🎯 关键位置分析
${supportResistance}

## 📋 投资决策框架

请基于上述技术指标进行深度分析，并重点关注以下内容：

### 1️⃣ **趋势确认分析**
- 多重时间框架的趋势一致性（1小时、4小时、日线）
- MACD、MA、RSI三者是否形成共振
- 趋势的持续强度和可持续性评估

### 2️⃣ **入场策略**
- 最优入场点位（基于支撑位、均线、布林带）
- 推荐建仓数量和建仓时机
- 分批建仓方案（如适用）
- 入场前的确认信号

### 3️⃣ **风险管理**
- **止损位设置**: 基于最近低点或技术支撑位下方2-3%
- **止盈目标**:
  - 第一目标位（阻力位1）
  - 第二目标位（阻力位2）
  - 极限目标位（关键技术阻力）
- **止损点至入场点的风险**
- **预期收益与风险的比率**（建议>1.5:1）

### 4️⃣ **仓位建议**
- 根据风险等级推荐仓位（%风险占总资本的百分比）
- 考虑波动率的仓位调整
- 分批建仓的建议比例

### 5️⃣ **持仓管理**
- 追踪止损设置方案
- 部分止盈时机
- 趋势逆转的预警信号
- 持仓时间预期

### 6️⃣ **风险警告**
- 当前最主要的风险因素
- 可能触发趋势反转的条件
- 市场异常信号
- 流动性风险评估

### 7️⃣ **综合评分**
请给出以下维度的评分（1-10分）：
- **技术面强度**: 
- **入场确定性**: 
- **风险调整后收益**: 
- **整体推荐指数**: 

## 📊 最终投资建议

请在以上分析基础上，给出：
1. **操作建议**：买入/卖出/持有/观望
2. **推荐理由**：3-5个核心理由
3. **最优执行方案**：具体的入场、持仓、出场计划
4. **替代方案**：如主方案失效的应急方案
5. **监控要点**：需要持续监控的关键价位和指标

请用专业、客观、详细的语言给出分析报告，确保投资建议具有可操作性和明确的风险管理框架。
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

    /**
     * 评估风险等级
     */
    private assessRiskLevel(indicators: IndicatorAnalysis): string {
        const { rsi, bollingerBands, volume, macd } = indicators;
        let riskScore = 0;

        // RSI上的风险
        if (rsi >= 70 || rsi <= 30) {
            riskScore += 2; // 超买或超卖
        } else if (rsi >= 65 || rsi <= 35) {
            riskScore += 1; // 接近超买或超卖
        }

        // 布林带上的风险
        if (bollingerBands?.bandwidth < 3) {
            riskScore += 1; // 波动率低，预示可能出现大幅波动
        } else if (bollingerBands?.bandwidth > 15) {
            riskScore += 1; // 波动率高，抖动大
        }

        // 成交量上的风险
        if (volume?.volumeRatio < 0.5) {
            riskScore += 1; // 成交量不足，流动性风险
        }

        // MACD上的风险
        if (Math.abs(macd?.histogram || 0) < 0.0001) {
            riskScore += 1; // 接近零轴，信号不明确
        }

        if (riskScore >= 5) return '极高 🔴';
        if (riskScore >= 4) return '较高 🟠';
        if (riskScore >= 2) return '中低 🟡';
        return '低 🟢';
    }

    /**
     * 计算支撑位和阻力位
     */
    private calculateSupportResistance(indicators: IndicatorAnalysis): string {
        const { currentPrice, bollingerBands, ma } = indicators;

        let support1 = bollingerBands?.lower || 0;
        let support2 = ma?.ma20 || 0;
        let resistance1 = bollingerBands?.upper || 0;
        let resistance2 = ma?.ma50 || 0;

        // 低位推计（基于布林带和均线）
        const supportDistance = ((currentPrice - support1) / currentPrice * 100);
        const resistanceDistance = ((resistance1 - currentPrice) / currentPrice * 100);

        return `### 支撑位分析
- **第一支撑位最近**: $${support1.toFixed(8)} (下降 ${supportDistance.toFixed(2)}%)
- **第二支撑位**: $${support2.toFixed(8)}

### 阻力位分析
- **第一阻力位最近**: $${resistance1.toFixed(8)} (上涨 ${resistanceDistance.toFixed(2)}%)
- **第二阻力位**: $${resistance2.toFixed(8)}

### 位置账户
- **当前价格位置**: $${currentPrice.toFixed(8)} (位于支撑-阻力之间)`;
    }

    /**
     * 分析成交量质量
     */
    private analyzeVolumeQuality(volume: any, priceData: any): string {
        if (!volume) return '数据不足 💤';

        const { volumeRatio, volumeTrend } = volume;

        // 综合估计
        if (volumeRatio > 1.5 && volumeTrend > 0) {
            return '优秀 🟢 (放量+上升趋势)';
        } else if (volumeRatio > 1.2) {
            return '良好 🟡 (温和放量)';
        } else if (volumeRatio < 0.7) {
            return '一般 🟠 (成交量不足)';
        } else {
            return '正常 ⚪ (间断总体水平)';
        }
    }
}
