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
exports.DeepSeekAnalyzer = void 0;
const undici_1 = require("undici");
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const dispatcher = new undici_1.ProxyAgent("http://127.0.0.1:7890");
(0, undici_1.setGlobalDispatcher)(dispatcher);
class DeepSeekAnalyzer {
    constructor(apiKey) {
        this.baseURL = 'https://api.deepseek.com/v1/chat/completions';
        this.apiKey = apiKey;
    }
    async analyzeTrend(indicators, symbol) {
        try {
            const summary = this.generateSummaryOutput(symbol, indicators);
            const analysis = await this.generateDetailedAnalysis(indicators, symbol);
            const fullReport = summary + '\n\n' + analysis;
            return {
                summary,
                analysis,
                fullReport
            };
        }
        catch (error) {
            console.error(`❌ DeepSeek趋势分析失败 (${symbol}):`, error);
            throw error;
        }
    }
    generateSummaryOutput(symbol, indicators) {
        const { currentPrice } = indicators;
        const signal = this.generateSimpleSignal(indicators);
        const signalMap = {
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
    async generateDetailedAnalysis(indicators, symbol) {
        const prompt = this.buildAnalysisPrompt(indicators, symbol);
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
            const rawData = await response.json();
            if (typeof rawData === 'object' &&
                rawData !== null &&
                'choices' in rawData) {
                const data = rawData;
                return data.choices[0]?.message?.content || '❌ 分析失败';
            }
            else {
                throw new Error('❌ 无效的DeepSeek API响应结构');
            }
        }
        catch (error) {
            console.error('❌ DeepSeek API调用失败:', error);
            return this.getFallbackAnalysis(indicators, symbol);
        }
    }
    buildAnalysisPrompt(indicators, symbol) {
        const { macd, volume, currentPrice, rsi, ma, bollingerBands } = indicators;
        const signal = this.generateSimpleSignal(indicators);
        const signalMap = {
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
    generateSimpleSignal(indicators) {
        const { macd, rsi, bollingerBands, volume } = indicators;
        let bullishScore = 0;
        let bearishScore = 0;
        if (macd?.histogram > 0 && macd?.macd > macd?.signal) {
            bullishScore += 2;
        }
        else if (macd?.histogram < 0 && macd?.macd < macd?.signal) {
            bearishScore += 2;
        }
        if (rsi >= 50 && rsi < 70) {
            bullishScore += 1;
        }
        else if (rsi >= 70) {
            bearishScore += 1;
        }
        else if (rsi < 50 && rsi > 30) {
            bearishScore += 1;
        }
        else if (rsi <= 30) {
            bullishScore += 1;
        }
        if (bollingerBands?.position === 'OVERSOLD') {
            bullishScore += 1;
        }
        else if (bollingerBands?.position === 'OVERBOUGHT') {
            bearishScore += 1;
        }
        if (volume?.volumeRatio > 1.2) {
            if (indicators.macd?.histogram > 0) {
                bullishScore += 1;
            }
            else {
                bearishScore += 1;
            }
        }
        if (bullishScore >= 4)
            return 'STRONG_BUY';
        if (bullishScore > bearishScore + 1)
            return 'BUY';
        if (bearishScore > bullishScore + 1)
            return 'SELL';
        if (bearishScore >= 4)
            return 'STRONG_SELL';
        return 'HOLD';
    }
    analyzeMACDStatus(macd) {
        if (!macd)
            return '';
        const status = macd.macd > macd.signal ? '🟢 看涨金叉' : macd.macd < macd.signal ? '🔴 看跌死叉' : '⚪ 中性整理';
        const trend = macd.histogram > 0 ? '🟢 多头动能增强' : '🔴 空头动能增强';
        return `**当前状态**: ${status}
**柱状图趋势**: ${trend}`;
    }
    getMAPosition(currentPrice, maValue) {
        if (!maValue)
            return '';
        const diffPercent = ((currentPrice - maValue) / maValue) * 100;
        if (diffPercent > 2)
            return '🟢 (价格上方)';
        if (diffPercent > 0)
            return '🟡 (略上方)';
        if (diffPercent > -2)
            return '🟠 (略下方)';
        return '🔴 (价格下方)';
    }
    analyzeMAArrangement(currentPrice, ma) {
        if (!ma)
            return '⚪ **数据不足**: 无法进行均线排列分析';
        const { ma5, ma10, ma20, ma50 } = ma;
        if (currentPrice > ma5 && ma5 > ma10 && ma10 > ma20) {
            if (ma50 && ma20 > ma50) {
                return '🟢 **完美多头排列**: 价格 > MA5 > MA10 > MA20 > MA50，趋势强劲';
            }
            return '🟢 **强势多头排列**: 价格 > MA5 > MA10 > MA20，短期均线呈多头排列';
        }
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
    analyzeBollingerStatus(currentPrice, bb) {
        if (!bb)
            return '';
        const { position, bandwidth } = bb;
        let status = '';
        if (position === 'OVERBOUGHT') {
            status = '🔴 **价格触及上轨**: 短期可能超买，注意回调风险';
        }
        else if (position === 'OVERSOLD') {
            status = '🟢 **价格触及下轨**: 短期可能超卖，存在反弹机会';
        }
        else if (currentPrice > bb.middle) {
            status = '🟡 **价格在中轨上方**: 偏多格局';
        }
        else {
            status = '🟠 **价格在中轨下方**: 偏空格局';
        }
        if (bandwidth < 3) {
            status += '，📉 **带宽极度收缩**: 波动率创近期新低，预示即将出现大幅波动';
        }
        else if (bandwidth > 10) {
            status += '，📈 **带宽大幅扩张**: 市场波动剧烈，趋势行情可能延续';
        }
        return `**布林带状态**: ${status}`;
    }
    analyzeVolumeStatus(volume) {
        if (!volume)
            return '';
        const { volumeRatio, volumeTrend } = volume;
        if (volumeRatio > 1.5) {
            return '**成交量状态**: 📈 **放量交易**: 成交量大幅放大，市场热度高';
        }
        else if (volumeRatio > 1.2) {
            return '**成交量状态**: 📊 **温和放量**: 成交量温和增加，买卖力量增强';
        }
        else if (volumeRatio < 0.7) {
            return '**成交量状态**: 📉 **萎缩成交**: 成交量大幅萎缩，市场热度低';
        }
        else {
            return '**成交量状态**: ⚪ **正常成交**: 成交量处于正常水平';
        }
    }
    analyzeRSIStatus(rsi) {
        if (rsi >= 70) {
            return `**RSI状态**: 🔴 **超买区域 (${rsi.toFixed(1)})** - RSI高于70，市场过热，短期回调风险大`;
        }
        else if (rsi >= 60) {
            return `**RSI状态**: 🟡 **强势区域 (${rsi.toFixed(1)})** - RSI在60-70，多头占优但接近超买`;
        }
        else if (rsi >= 40) {
            return `**RSI状态**: ⚪ **平衡区域 (${rsi.toFixed(1)})** - RSI在40-60，多空力量相对平衡`;
        }
        else if (rsi >= 30) {
            return `**RSI状态**: 🟠 **弱势区域 (${rsi.toFixed(1)})** - RSI在30-40，空头占优但接近超卖`;
        }
        else {
            return `**RSI状态**: 🟢 **超卖区域 (${rsi.toFixed(1)})** - RSI低于30，市场超卖，存在反弹机会`;
        }
    }
    getFallbackAnalysis(indicators, symbol) {
        const signal = this.generateSimpleSignal(indicators);
        const signalMap = {
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
exports.DeepSeekAnalyzer = DeepSeekAnalyzer;
//# sourceMappingURL=deepseekAnalyzer.js.map