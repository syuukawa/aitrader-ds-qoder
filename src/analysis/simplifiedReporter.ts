// src/analysis/simplifiedReporter.ts
// 简化报告生成器 - 生成Markdown和JSON格式的交易信号汇总报告

/**
 * 简化摘要接口 - 用于报告生成
 */
export interface SimplifiedSummary {
    symbol: string;
    currentPrice: number;
    signal: string;
    confidence: number;
    timestamp: number;
}

/**
 * 简化报告生成器
 */
export class SimplifiedReporter {
    /**
     * 生成Markdown格式的简化报告
     */
    static generateMarkdownReport(summaries: SimplifiedSummary[]): string {
        // 按信号强度排序
        const sorted = this.sortBySignalStrength(summaries);

        let content = `# 📊 交易对监控简要报告\n\n`;
        content += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n`;
        content += `**监控数量**: ${summaries.length} 个交易对\n\n`;

        content += `## 📋 交易对信号列表\n\n`;

        // 创建Markdown表格
        content += `| 序号 | 交易对 | 当前价格 | 交易信号 | 置信度 |\n`;
        content += `|------|--------|----------|----------|--------|\n`;

        sorted.forEach((summary, index) => {
            const signalEmoji = this.getSignalEmoji(summary.signal);
            content += `| ${index + 1} | ${summary.symbol} | ${summary.currentPrice.toFixed(8)} | ${signalEmoji} ${summary.signal} | ${summary.confidence.toFixed(1)}% |\n`;
        });

        // 添加统计部分
        // content += `\n## 📈 信号分布统计\n\n`;
        // content += this.generateStatistics(summaries);

        return content;
    }

    /**
     * 生成JSON格式的简化报告（便于程序处理）
     */
    static generateJSONReport(summaries: SimplifiedSummary[]): string {
        const report = {
            timestamp: Date.now(),
            count: summaries.length,
            symbols: summaries,
            statistics: this.calculateStatistics(summaries)
        };

        return JSON.stringify(report, null, 2);
    }

    /**
     * 按信号强度排序
     */
    private static sortBySignalStrength(summaries: SimplifiedSummary[]): SimplifiedSummary[] {
        // 定义信号权重（数值越小，优先级越高）
        const signalWeights: Record<string, number> = {
            '强烈买入': 0,
            '买入': 1,
            '持有': 2,
            '卖出': 3,
            '强烈卖出': 4
        };

        return summaries.sort((a, b) => {
            // 首先按信号类型排序
            const weightA = signalWeights[a.signal] !== undefined ? signalWeights[a.signal] : Infinity;
            const weightB = signalWeights[b.signal] !== undefined ? signalWeights[b.signal] : Infinity;

            if (weightA !== weightB) {
                return weightA - weightB;
            }

            // 信号类型相同，则按置信度降序排列
            return b.confidence - a.confidence;
        });
    }

    /**
     * 获取信号对应的表情符号
     */
    private static getSignalEmoji(signal: string): string {
        const emojiMap: Record<string, string> = {
            '强烈买入': '🟢',
            '买入': '🟡',
            '持有': '⚪',
            '卖出': '🟠',
            '强烈卖出': '🔴'
        };
        return emojiMap[signal] ?? '⚪';
    }

    /**
     * 生成统计信息部分
     */
    private static generateStatistics(summaries: SimplifiedSummary[]): string {
        const stats = this.calculateStatistics(summaries);

        let content = '';
        content += `### 信号分类统计\n`;
        content += `- **强烈买入 🟢**: ${stats.counts['强烈买入']} 个交易对\n`;
        content += `- **买入 🟡**: ${stats.counts['买入']} 个交易对\n`;
        content += `- **持有 ⚪**: ${stats.counts['持有']} 个交易对\n`;
        content += `- **卖出 🟠**: ${stats.counts['卖出']} 个交易对\n`;
        content += `- **强烈卖出 🔴**: ${stats.counts['强烈卖出']} 个交易对\n\n`;

        content += `### 市场情绪分析\n`;
        content += `- **看涨比例**: ${stats.bullishRatio}%\n`;
        content += `- **看跌比例**: ${stats.bearishRatio}%\n`;
        content += `- **市场热度**: ${stats.marketSentiment}\n`;
        content += `- **建议操作**: ${stats.tradingSuggestion}\n`;

        return content;
    }

    /**
     * 计算统计数据
     */
    private static calculateStatistics(summaries: SimplifiedSummary[]): any {
        // 初始化信号计数
        const counts: Record<string, number> = {
            '强烈买入': 0,
            '买入': 0,
            '持有': 0,
            '卖出': 0,
            '强烈卖出': 0
        };

        // 统计各信号的数量
        summaries.forEach(summary => {
            const signal = summary.signal;
            if (signal in counts) {
                counts[signal]++;
            }
        });

        // 计算看涨和看跌的交易对数量
        const bullishCount = counts['强烈买入'] + counts['买入'];
        const bearishCount = counts['强烈卖出'] + counts['卖出'];
        const totalTradable = summaries.length - counts['持有'];

        // 计算看涨比例
        const bullishRatio = totalTradable > 0 ? (bullishCount / totalTradable * 100).toFixed(1) : '0.0';
        const bearishRatio = totalTradable > 0 ? (bearishCount / totalTradable * 100).toFixed(1) : '0.0';

        // 市场情绪判断
        let marketSentiment = '中性 ⚪';
        if (bullishCount > bearishCount * 2) {
            marketSentiment = '极度乐观 🟢🟢🟢';
        } else if (bullishCount > bearishCount) {
            marketSentiment = '乐观 🟢🟢';
        } else if (bearishCount > bullishCount * 2) {
            marketSentiment = '极度悲观 🔴🔴🔴';
        } else if (bearishCount > bullishCount) {
            marketSentiment = '悲观 🔴🔴';
        }

        // 交易建议
        let tradingSuggestion = '保持观望 ⚪';
        const bullPercentage = parseFloat(bullishRatio);
        if (bullPercentage > 70) {
            tradingSuggestion = '积极做多 🟢 (看涨超过70%)';
        } else if (bullPercentage > 60) {
            tradingSuggestion = '适度做多 🟡 (看涨超过60%)';
        } else if (bullPercentage < 30) {
            tradingSuggestion = '积极做空 🔴 (看涨低于30%)';
        } else if (bullPercentage < 40) {
            tradingSuggestion = '适度做空 🟠 (看涨低于40%)';
        }

        return {
            counts,
            bullishRatio,
            bearishRatio,
            marketSentiment,
            tradingSuggestion,
            total: summaries.length,
            bullish: bullishCount,
            bearish: bearishCount
        };
    }
}
