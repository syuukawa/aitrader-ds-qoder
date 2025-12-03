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
     * 切换为短线交易模式的分析
     * 使用优化的短线Prompt，聚焦于15分钟快速操作
     */
    async analyzeTrendShortline(indicators: IndicatorAnalysis, symbol: string): Promise<{
        summary: string;
        analysis: string;
        fullReport: string;
    }> {
        try {
            const summary = this.generateSummaryOutput(symbol, indicators);
            // 使用短线专用模式
            const analysis = await this.generateDetailedAnalysis(indicators, symbol, true);
            const fullReport = summary + '\n\n' + analysis;

            return {
                summary,
                analysis,
                fullReport
            };
        } catch (error) {
            console.error(`❌ DeepSeek短线分析失败 (${symbol}):`, error);
            throw error;
        }
    }

    /**
     * 生成详细分析 - 支持短线和通用模式
     */
    private async generateDetailedAnalysis(indicators: IndicatorAnalysis, symbol: string, shortlineMode: boolean = false): Promise<string> {
        const prompt = shortlineMode 
            ? this.buildShortlineTradingPrompt(indicators, symbol)
            : this.buildAnalysisPrompt(indicators, symbol);

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
     * 构建短线交易专用Prompt（15分钟K线优化版）
     * 相比通用版本，更聚焦于短线操作的具体细节
     */
    private buildShortlineTradingPrompt(indicators: IndicatorAnalysis, symbol: string): string {
        const { macd, volume, currentPrice, rsi, ma, bollingerBands, priceData } = indicators;

        // 关键位置计算
        const ma5Distance = currentPrice - (ma?.ma5 || 0);
        const ma20Distance = currentPrice - (ma?.ma20 || 0);
        const bbUpperDistance = (bollingerBands?.upper || 0) - currentPrice;
        const bbLowerDistance = currentPrice - (bollingerBands?.lower || 0);

        const ma5DistancePercent = ((ma5Distance / currentPrice) * 100).toFixed(2);
        const ma20DistancePercent = ((ma20Distance / currentPrice) * 100).toFixed(2);
        const bbUpperPercent = ((bbUpperDistance / currentPrice) * 100).toFixed(2);
        const bbLowerPercent = ((bbLowerDistance / currentPrice) * 100).toFixed(2);

        // 波动率评估
        const volatility = this.calculateVolatility(priceData);
        const avgTrueRange = this.calculateATR(priceData);
        const dynamicStopLossPercent = ((avgTrueRange / currentPrice) * 100).toFixed(2);

        return `
## 🎯 短线交易实战分析 (15分钟K线)

**品种**: ${symbol}
**当前价格**: $${currentPrice.toFixed(8)}
**分析时间**: 北京时间
**持仓目标**: 5-30分钟快速操作

---

### 📊 市场现状评估

#### 1️⃣ 趋势方向确认 (MA系统)

**短期趋势** (MA5, MA10, MA20):
- MA5: $${ma?.ma5?.toFixed(8) || 'N/A'}
- MA10: $${ma?.ma10?.toFixed(8) || 'N/A'}
- MA20: $${ma?.ma20?.toFixed(8) || 'N/A'}
- MA50: $${ma?.ma50?.toFixed(8) || 'N/A'}

**价格位置**:
- 距MA5: ${ma5DistancePercent}% ${parseFloat(ma5DistancePercent) > 0 ? '(上方,看多)' : '(下方,看空)'}
- 距MA20: ${ma20DistancePercent}% ${parseFloat(ma20DistancePercent) > 0 ? '(上方,看多)' : '(下方,看空)'}

${this.analyzeMAArrangement(currentPrice, ma)}

---

#### 2️⃣ 动能强度 (MACD系统) - 最关键

**MACD数值**:
- MACD线: ${macd?.macd?.toFixed(8) || 'N/A'}
- 信号线: ${macd?.signal?.toFixed(8) || 'N/A'}
- 柱状体: ${macd?.histogram?.toFixed(8) || 'N/A'}

${this.analyzeMACDStatus(macd)}

**关键判断**: MACD柱子是否在加速? MACD是否即将反转? 是否穿过0轴?

---

#### 3️⃣ 超买超卖程度 (RSI)

**RSI值**: ${rsi?.toFixed(2) || 'N/A'}

${this.analyzeRSIStatus(rsi)}

---

#### 4️⃣ 波动率与支撑阻力 (布林带)

**布林带参数**:
- 上轨(阻力): $${bollingerBands?.upper?.toFixed(8) || 'N/A'} (上方 ${bbUpperPercent}%)
- 中轨(趋势): $${bollingerBands?.middle?.toFixed(8) || 'N/A'}
- 下轨(支撑): $${bollingerBands?.lower?.toFixed(8) || 'N/A'} (下方 ${bbLowerPercent}%)
- 带宽: ${bollingerBands?.bandwidth?.toFixed(2) || 'N/A'}%

${this.analyzeBollingerStatus(currentPrice, bollingerBands)}

---

#### 5️⃣ 市场热度 (成交量)

**成交量数据**:
- 当前成交量: ${volume?.currentVolume?.toFixed(2) || 'N/A'}
- 近期平均: ${volume?.averageVolume?.toFixed(2) || 'N/A'}
- 成交量比率: ${volume?.volumeRatio?.toFixed(2) || 'N/A'}x
- 成交量趋势: ${volume?.volumeTrend?.toFixed(6) || 'N/A'}

${this.analyzeVolumeStatus(volume)}

${macd?.histogram > 0 && (volume?.volumeRatio || 0) > 1.2 ? '**✅ 上升放量 - 强势确认!**' : ''}
${macd?.histogram < 0 && (volume?.volumeRatio || 0) > 1.2 ? '**⚠️ 下跌放量 - 有抛售压力!**' : ''}

---

### 🎬 短线进场信号分析

#### ✅ 多头进场检查清单

请评估以下条件是否满足：
- MA系统: 价格 > MA5 > MA10 > MA20
- MACD: 在0轴上方，柱子正值且加速
- RSI: 50-70区间或刚穿越50向上
- 成交量: 放量 (>1.2x) 配合价格上升
- K线形态: 底部反弹或缩量后放量突破

**信号评分**: ___/5 (请评估满足条件的个数)
- 5/5 = 🟢 极强烈买入 (概率70%+)
- 4/5 = 🟡 强买入 (概率60-70%)
- 3/5 = 🟠 可参与 (概率50-60%)
- <3/5 = 🔴 信号不足，建议观望

---

### 💰 精确的进出场计划

#### 📍 推荐进场方案

**进场点位**:
1. 即刻进场价: $${currentPrice.toFixed(8)}
2. 理想回调进场: $${(currentPrice * 0.998).toFixed(8)} (下跌0.2%)
3. 最后上车点: $${(currentPrice * 1.002).toFixed(8)} (上升0.2%)

${volume?.volumeRatio > 1.5 ? '**进场方式**: 100% 一次性上车 (放量驱动，机会明确)' : volume?.volumeRatio > 1.2 ? '**进场方式**: 60% 首批上车，等回调加30% (温和放量)' : '**进场方式**: 50% 首批上车，等确认加50% (谨慎参与)'}

---

#### 🛑 精确止损计划 (最关键!)

**止损的核心原则**: 不能用固定点数，必须用技术位 + 波动率调整

**方案A - 激进止损** (用于强势信号 >= 4/5)
- 止损位: $${(ma?.ma5 || currentPrice * 0.99).toFixed(8)} (MA5下方)
- 止损幅度: ${((currentPrice - (ma?.ma5 || currentPrice * 0.99)) / currentPrice * 100).toFixed(2)}%
- 适用: MACD金叉+放量+RSI 50-70

**方案B - 保守止损** (用于一般信号 3/5)
- 止损位: $${(ma?.ma20 || currentPrice * 0.98).toFixed(8)} (MA20下方 1-2%)
- 止损幅度: ${((currentPrice - (ma?.ma20 || currentPrice * 0.98)) / currentPrice * 100).toFixed(2)}%
- 适用: 信号混合，需要更多安全边际

**方案C - 绝对止损** (用于高风险信号 <3/5)
- 止损位: $${(currentPrice * 0.97).toFixed(8)} (价格下方3%)
- 止损幅度: 3%
- 适用: 只有部分信号满足

**选择建议**: 根据上面的信号评分选择合适的方案

---

#### ✅ 分阶段止盈计划

**第一止盈目标** (锁定快速利润):
- 目标价位: $${(currentPrice * 1.005).toFixed(8)} (上升 0.5%)
- 动作: 卖出 40% 头寸
- 理由: 快速锁定利润，降低风险

**第二止盈目标** (跟踪趋势):
- 目标价位: $${(currentPrice * 1.01).toFixed(8)} (上升 1.0%)
- 动作: 卖出 30% 头寸，剩余设追踪止损
- 理由: 继续参与趋势，保护利润

**第三止盈目标** (趋势延续):
- 目标价位: $${(currentPrice * 1.015).toFixed(8)} (上升 1.5%)
- 动作: 卖出全部剩余头寸
- 理由: 短线到此为止，不贪

---

#### 📊 风险回报比计算

| 指标 | 数值 |
|------|------|
| 入场价 | $${currentPrice.toFixed(8)} |
| 止损价 (方案B) | $${(ma?.ma20 || currentPrice * 0.98).toFixed(8)} |
| 风险空间 | $${(currentPrice - (ma?.ma20 || currentPrice * 0.98)).toFixed(2)} |
| 第一目标 | $${(currentPrice * 1.005).toFixed(8)} |
| 利润空间1 | $${((currentPrice * 1.005) - currentPrice).toFixed(2)} |
| R:R 比1 | ${(((currentPrice * 1.005) - currentPrice) / (currentPrice - (ma?.ma20 || currentPrice * 0.98))).toFixed(2)}:1 |

**可交易性判断**: 
${(((currentPrice * 1.01) - currentPrice) / (currentPrice - (ma?.ma20 || currentPrice * 0.98))) >= 1.5 ? '✅ R:R >= 1.5:1，符合短线标准，可以交易' : '⚠️ R:R < 1.5:1，风险回报不够好，建议等待'}

---

### ⚠️ 风险警告与立即平仓条件

**必须立即平仓的条件** (不管多看好):

1️⃣ **技术破位**
   - 如果 MA5 被击穿 + 跌破1根K线范围 → 立即全部平仓

2️⃣ **MACD反转**
   - 如果 MACD 柱子从扩大变为缩小 3根 → 警告，准备退出
   - 如果 MACD 负穿 0轴 → 立即平仓

3️⃣ **成交量异常**
   - 如果价格下跌伴随放量(>1.5x) → 立即全部平仓

4️⃣ **时间止损**
   - 如果已持仓 15 分钟，还没有明确方向 → 平仓休息
   - 如果已持仓 30 分钟，已获利但可能反转 → 全部出场

---

### 📋 最终操作建议 (三句话核心)

**1. 现在做什么**:
${currentPrice > (ma?.ma5 || 0) && macd?.histogram > 0 && rsi > 50 ? '[BUY]' : currentPrice < (ma?.ma5 || 0) && macd?.histogram < 0 && rsi < 50 ? '[SELL]' : '[WAIT]'} 进场点位: $${currentPrice.toFixed(8)}
理由: [2-3 个最关键的信号]

**2. 止损在哪**:
价格: $${(ma?.ma20 || currentPrice * 0.98).toFixed(8)}
原因: [基于哪个技术位]
风险: ${((currentPrice - (ma?.ma20 || currentPrice * 0.98)) / currentPrice * 100).toFixed(2)}%

**3. 目标是哪**:
第一: $${(currentPrice * 1.005).toFixed(8)}
第二: $${(currentPrice * 1.01).toFixed(8)}
第三: $${(currentPrice * 1.015).toFixed(8)}

---

**本次分析的信心水平**:
- 信号一致性: ___/5
- 建议参与等级: ${(volume?.volumeRatio >= 1.2 && macd?.histogram > 0 && rsi > 50) ? '🟢 高概率 (可参与)' : (volume?.volumeRatio >= 1.2 && macd?.histogram > 0) ? '🟡 中等 (谨慎)' : '🔴 低概率 (观望)'}

**最终结论**: ${volume?.volumeRatio >= 1.2 && macd?.histogram > 0 && rsi > 50 ? '✅ 信号良好，可以参与' : '⚠️ 信号不够强，建议观望'}
        `;
    }

    /**
     * 计算波动率
     */
    private calculateVolatility(priceData: any): number {
        if (!priceData?.closes || priceData.closes.length < 20) return 0;
        const closes = priceData.closes.slice(-20);
        const avg = closes.reduce((a: number, b: number) => a + b) / closes.length;
        const variance = closes.reduce((sum: number, price: number) => sum + Math.pow(price - avg, 2), 0) / closes.length;
        return Math.sqrt(variance);
    }

    /**
     * 计算ATR(平均真实波幅)
     */
    private calculateATR(priceData: any): number {
        if (!priceData?.highs || !priceData?.lows || !priceData?.closes) return 0;
        const trueRanges: number[] = [];
        const len = Math.min(priceData.highs.length, priceData.lows.length, priceData.closes.length);

        for (let i = 1; i < len; i++) {
            const tr = Math.max(
                priceData.highs[i] - priceData.lows[i],
                Math.abs(priceData.highs[i] - priceData.closes[i - 1]),
                Math.abs(priceData.lows[i] - priceData.closes[i - 1])
            );
            trueRanges.push(tr);
        }

        if (trueRanges.length === 0) return 0;
        const recent = trueRanges.slice(-14);
        return recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
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
        return `**当前状态**: ${status}\n**柱状图趋势**: ${trend}`;
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
