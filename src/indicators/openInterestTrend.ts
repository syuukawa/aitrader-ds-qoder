// src/indicators/openInterestTrend.ts
import { OpenInterestData } from '../binance/types';

export interface OpenInterestTrendResult {
    trend: 'UP' | 'DOWN' | 'NEUTRAL';  // 趋势方向
    strength: number;                  // 趋势强度 (0-100)
    growthRate: number;                // 增长率 (%)
    averageOI: number;                 // 平均OI值
    latestOI: number;                  // 最新OI值
    volatility: number;                // 波动性
}

export class OpenInterestTrendAnalyzer {
    /**
     * 分析15分钟OI数据的趋势
     * @param openInterestData 15分钟间隔的OI数据数组，至少需要2个数据点
     * @returns OpenInterestTrendResult 趋势分析结果
     */
    static analyzeTrend(openInterestData: OpenInterestData[]): OpenInterestTrendResult {
        if (!openInterestData || openInterestData.length < 2) {
            return {
                trend: 'NEUTRAL',
                strength: 0,
                growthRate: 0,
                averageOI: 0,
                latestOI: 0,
                volatility: 0
            };
        }

        // 提取OI数值（转换为数字）
        const oiValues = openInterestData.map(data => parseFloat(data.sumOpenInterestValue));
        
        // 计算平均值
        const averageOI = oiValues.reduce((sum, value) => sum + value, 0) / oiValues.length;
        
        // 获取最新值
        const latestOI = oiValues[oiValues.length - 1];
        
        // 计算增长率 (%)
        const firstOI = oiValues[0];
        const growthRate = firstOI !== 0 ? ((latestOI - firstOI) / firstOI) * 100 : 0;
        
        // 计算波动性（标准差）
        const variance = oiValues.reduce((sum, value) => sum + Math.pow(value - averageOI, 2), 0) / oiValues.length;
        const volatility = Math.sqrt(variance);
        
        // 确定趋势方向
        let trend: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
        let strength = 0;
        
        if (growthRate > 2) {  // 增长大于2%认为是上升趋势
            trend = 'UP';
            strength = Math.min(100, Math.abs(growthRate) * 5);  // 强度与增长率相关
        } else if (growthRate < -2) {  // 下降大于2%认为是下降趋势
            trend = 'DOWN';
            strength = Math.min(100, Math.abs(growthRate) * 5);
        } else {
            trend = 'NEUTRAL';
            strength = Math.min(50, Math.abs(growthRate) * 10);  // 中性趋势强度较低
        }
        
        return {
            trend,
            strength,
            growthRate,
            averageOI,
            latestOI,
            volatility
        };
    }
    
    /**
     * 计算OI趋势信号
     * @param trendResult 趋势分析结果
     * @returns 信号和置信度
     */
    static calculateSignal(trendResult: OpenInterestTrendResult): { signal: string; confidence: number } {
        // 根据趋势和强度生成信号
        switch (trendResult.trend) {
            case 'UP':
                if (trendResult.strength > 70) {
                    return { signal: 'STRONG_BUY', confidence: Math.min(95, trendResult.strength) };
                } else if (trendResult.strength > 40) {
                    return { signal: 'BUY', confidence: Math.min(80, trendResult.strength) };
                } else {
                    return { signal: 'HOLD', confidence: Math.min(60, trendResult.strength + 20) };
                }
            case 'DOWN':
                if (trendResult.strength > 70) {
                    return { signal: 'STRONG_SELL', confidence: Math.min(95, trendResult.strength) };
                } else if (trendResult.strength > 40) {
                    return { signal: 'SELL', confidence: Math.min(80, trendResult.strength) };
                } else {
                    return { signal: 'HOLD', confidence: Math.min(60, trendResult.strength + 20) };
                }
            case 'NEUTRAL':
            default:
                return { signal: 'HOLD', confidence: Math.min(50, 50 - (trendResult.volatility / trendResult.averageOI) * 1000) };
        }
    }
}