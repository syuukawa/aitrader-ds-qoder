// src/indicators/volume.ts
export class VolumeAnalyzer {
    static calculateVolumeProfile(
        volumes: number[],
        prices: number[],
        periods: number = 20,
        trendPeriod?: number
    ): any {
        // If trendPeriod is not provided, use periods
        const trendPeriods = trendPeriod || periods;

        const recentVolumes = volumes.slice(-periods);
        const avgVolume = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
        const currentVolume = volumes[volumes.length - 1];

        // 计算OBV (On-Balance Volume) - 能量潮
        const obv = this.calculateOBV(volumes, prices);
        const obvSignal = this.calculateEMA(obv, 9);  // OBV的9周期EMA
        const obvTrend = obv.length > 1 ? obv[obv.length - 1] - obv[obv.length - 2] : 0;

        // 计算VWAP (Volume Weighted Average Price) - 成交量加权平均价
        const vwap = this.calculateVWAP(prices, volumes);
        const currentVWAP = vwap.length > 0 ? vwap[vwap.length - 1] : prices[prices.length - 1];

        // 量价确认 (Volume Price Confirmation)
        const vpc = this.calculateVolumePriceConfirmation(volumes, prices);

        return {
            currentVolume,
            averageVolume: avgVolume,
            volumeRatio: currentVolume / avgVolume,
            volumeTrend: this.calculateVolumeTrend(volumes, trendPeriods),
            // OBV指标
            obv: obv[obv.length - 1],
            obvSignal: obvSignal[obvSignal.length - 1],
            obvTrend: obvTrend,  // OBV变化方向
            obvStrength: Math.abs(obvTrend),  // OBV强度
            // VWAP指标
            vwap: currentVWAP,
            vwapDiff: prices[prices.length - 1] - currentVWAP,  // 价格与VWAP偏差
            vwapRatio: (prices[prices.length - 1] - currentVWAP) / currentVWAP,  // VWAP偏差率
            // 量价确认
            volumePriceConfirmation: vpc[vpc.length - 1],  // 1=量价齐升, -1=量价背离, 0=中性
            volumePriceStrength: vpc[vpc.length - 1],  // 量价强度指标
        };
    }

    /**
     * 计算OBV (On-Balance Volume)
     * OBV = 前一日OBV + (若当日收盘价>前日收盘价，则加上当日成交量；反之减去当日成交量)
     */
    private static calculateOBV(volumes: number[], prices: number[]): number[] {
        const obv: number[] = [volumes[0]];  // 初始OBV = 第一根K线的成交量

        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) {
                obv.push(obv[i - 1] + volumes[i]);
            } else if (prices[i] < prices[i - 1]) {
                obv.push(obv[i - 1] - volumes[i]);
            } else {
                obv.push(obv[i - 1]);  // 价格不变，OBV不变
            }
        }

        return obv;
    }

    /**
     * 计算VWAP (Volume Weighted Average Price)
     * VWAP = ∑(成交量 * 典型价格) / ∑成交量
     * 典型价格 = (最高价 + 最低价 + 收盘价) / 3
     */
    private static calculateVWAP(prices: number[], volumes: number[], highs?: number[], lows?: number[]): number[] {
        // 如果没有提供高低价，使用收盘价作为典型价
        const vwapValues: number[] = [];
        let cumulativeTPV = 0;  // 累计成交量*典型价
        let cumulativeVolume = 0;  // 累计成交量

        for (let i = 0; i < prices.length; i++) {
            const typicalPrice = prices[i];  // 简化: 仅使用收盘价
            cumulativeTPV += typicalPrice * volumes[i];
            cumulativeVolume += volumes[i];
            vwapValues.push(cumulativeTPV / (cumulativeVolume || 1));
        }

        return vwapValues;
    }

    /**
     * 量价确认指标
     * 1: 量价齐升（看涨）
     * -1: 量价背离（看跌）
     * 0: 中性
     */
    private static calculateVolumePriceConfirmation(volumes: number[], prices: number[], period: number = 5): number[] {
        const vpc: number[] = [0];  // 第一根无法确认
        const avgVolume = volumes.slice(0, Math.min(period, volumes.length)).reduce((a, b) => a + b) / Math.min(period, volumes.length);

        for (let i = 1; i < prices.length; i++) {
            const priceUp = prices[i] > prices[i - 1];
            const volumeHigh = volumes[i] > avgVolume;

            if (priceUp && volumeHigh) {
                vpc.push(1);  // 量价齐升
            } else if (!priceUp && volumeHigh) {
                vpc.push(-1);  // 量价背离（放量下跌）
            } else if (priceUp && !volumeHigh) {
                vpc.push(-0.5);  // 无量上涨（陷阱）
            } else {
                vpc.push(0);  // 其他情况
            }
        }

        return vpc;
    }

    /**
     * 计算EMA (Exponential Moving Average)
     */
    private static calculateEMA(data: number[], period: number): number[] {
        if (data.length === 0) return [];
        
        const k = 2 / (period + 1);
        const ema: number[] = [data[0]];

        for (let i = 1; i < data.length; i++) {
            ema.push(data[i] * k + ema[i - 1] * (1 - k));
        }

        return ema;
    }

    private static calculateVolumeTrend(volumes: number[], trendPeriods: number): number {
        if (volumes.length < trendPeriods) {
            return 0;
        }

        const recentVolumes = volumes.slice(-trendPeriods);
        const sumX = recentVolumes.reduce((sum, _, i) => sum + i, 0);
        const sumY = recentVolumes.reduce((sum, vol) => sum + vol, 0);
        const sumXY = recentVolumes.reduce((sum, vol, i) => sum + vol * i, 0);
        const sumXX = recentVolumes.reduce((sum, _, i) => sum + i * i, 0);

        const n = recentVolumes.length;
        const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);

        return slope;
    }
}