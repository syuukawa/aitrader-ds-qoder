// src/indicators/momentum.ts

/**
 * KDJ随机指标 - 用于动量和超买超卖检测
 * K值 = 100 * (收盘价-9周期最低价) / (9周期最高价-9周期最低价)
 * D值 = K值的3周期SMA
 * J值 = 3*K - 2*D
 */
export interface KDJResult {
    k: number;  // K值
    d: number;  // D值
    j: number;  // J值
}

/**
 * 威廉指标 (%R)
 * Williams %R = -100 * (最高价 - 收盘价) / (最高价 - 最低价)
 * 范围: -100 到 0
 * > -20: 超买
 * < -80: 超卖
 */
export interface WilliamsResult {
    williamsr: number;  // 威廉指标值 (-100 ~ 0)
}

export class MomentumIndicators {
    /**
     * 计算KDJ指标
     */
    static calculateKDJ(highs: number[], lows: number[], closes: number[], period: number = 9, smoothK: number = 3, smoothD: number = 3): KDJResult[] {
        const results: KDJResult[] = [];
        
        const kValues: number[] = [];

        // 计算原始K值
        for (let i = 0; i < closes.length; i++) {
            if (i < period - 1) {
                // 数据不足时，使用50作为中性值
                kValues.push(50);
                results.push({ k: 50, d: 50, j: 50 });
                continue;
            }

            const periodHigh = Math.max(...highs.slice(i - period + 1, i + 1));
            const periodLow = Math.min(...lows.slice(i - period + 1, i + 1));
            const close = closes[i];

            let k: number;
            if (periodHigh === periodLow) {
                k = 50;  // 避免除以0
            } else {
                k = 100 * (close - periodLow) / (periodHigh - periodLow);
            }

            kValues.push(k);
        }

        // 对K值进行SMA平滑
        const smoothedK = this.calculateSMA(kValues, smoothK);

        // 对平滑后的K值再进行SMA得到D值
        const smoothedD = this.calculateSMA(smoothedK, smoothD);

        // 计算J值
        for (let i = 0; i < smoothedK.length; i++) {
            const k = smoothedK[i];
            const d = smoothedD[i];
            const j = 3 * k - 2 * d;

            results[i] = { k, d, j };
        }

        return results;
    }

    /**
     * 计算威廉指标 (%R)
     */
    static calculateWilliamsR(highs: number[], lows: number[], closes: number[], period: number = 14): WilliamsResult[] {
        const results: WilliamsResult[] = [];

        for (let i = 0; i < closes.length; i++) {
            if (i < period - 1) {
                // 数据不足时，返回0
                results.push({ williamsr: 0 });
                continue;
            }

            const periodHigh = Math.max(...highs.slice(i - period + 1, i + 1));
            const periodLow = Math.min(...lows.slice(i - period + 1, i + 1));
            const close = closes[i];

            let williamsr: number;
            if (periodHigh === periodLow) {
                williamsr = 0;  // 避免除以0
            } else {
                williamsr = -100 * (periodHigh - close) / (periodHigh - periodLow);
            }

            results.push({ williamsr });
        }

        return results;
    }

    /**
     * 计算简单移动平均(SMA)
     */
    private static calculateSMA(data: number[], period: number): number[] {
        const result: number[] = [];

        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                // 数据不足时，使用50作为中性值
                result.push(50);
                continue;
            }

            const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            result.push(sum / period);
        }

        return result;
    }
}
