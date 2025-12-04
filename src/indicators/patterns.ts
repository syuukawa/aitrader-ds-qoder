// src/indicators/patterns.ts

export interface PatternDetectionResult {
    pattern: string;  // 形态名称
    confidence: number;  // 置信度 (0-1)
    signal: number;  // 信号强度 (-2到+2)
}

/**
 * K线形态识别系统
 * 识别经典的短线形态:
 * - 早晨之星: 看涨形态（底部反转）
 * - 黄昏之星: 看跌形态（顶部反转）
 * - 吞没形态: 看涨/看跌反转信号
 * - 锤子线: 看涨反转
 * - 倒锤子线: 看跌反转
 */
export class PatternDetector {
    /**
     * 检测K线形态
     */
    static detectPatterns(klines: any[]): PatternDetectionResult[] {
        const patterns: PatternDetectionResult[] = [];

        if (klines.length < 3) {
            return patterns;  // 数据不足
        }

        // 检测早晨之星
        const morningStar = this.detectMorningStar(klines);
        if (morningStar) {
            patterns.push(morningStar);
        }

        // 检测黄昏之星
        const eveningStar = this.detectEveningStar(klines);
        if (eveningStar) {
            patterns.push(eveningStar);
        }

        // 检测吞没形态
        const engulfing = this.detectEngulfing(klines);
        if (engulfing) {
            patterns.push(engulfing);
        }

        // 检测锤子线
        const hammer = this.detectHammer(klines);
        if (hammer) {
            patterns.push(hammer);
        }

        // 检测倒锤子线
        const inverseHammer = this.detectInverseHammer(klines);
        if (inverseHammer) {
            patterns.push(inverseHammer);
        }

        return patterns;
    }

    /**
     * 识别早晨之星（看涨反转）
     * 1. 第一根是阴线，实体较大
     * 2. 第二根是小实体线，可以是十字线或小阴阳线
     * 3. 第三根是阳线，收盘价超过第一根阴线中点
     */
    private static detectMorningStar(klines: any[]): PatternDetectionResult | null {
        if (klines.length < 3) return null;

        const first = klines[klines.length - 3];
        const second = klines[klines.length - 2];
        const third = klines[klines.length - 1];

        // 第一根是阴线
        if (first.close >= first.open) return null;

        // 第二根是小实体
        const secondBodySize = Math.abs(second.close - second.open);
        const firstBodySize = Math.abs(first.close - first.open);
        if (secondBodySize > firstBodySize * 0.5) return null;

        // 第三根是阳线，且收盘价超过第一根中点
        if (third.close <= third.open) return null;
        const midPoint = (first.open + first.close) / 2;
        if (third.close < midPoint) return null;

        // 计算置信度
        const confidence = Math.min(0.95, 0.7 + (third.close - first.close) / (first.open - first.close) * 0.25);

        return {
            pattern: '早晨之星 🌅',
            confidence,
            signal: 1.5  // 强看涨信号
        };
    }

    /**
     * 识别黄昏之星（看跌反转）
     * 1. 第一根是阳线，实体较大
     * 2. 第二根是小实体线，可以是十字线或小阴阳线
     * 3. 第三根是阴线，收盘价低于第一根阳线中点
     */
    private static detectEveningStar(klines: any[]): PatternDetectionResult | null {
        if (klines.length < 3) return null;

        const first = klines[klines.length - 3];
        const second = klines[klines.length - 2];
        const third = klines[klines.length - 1];

        // 第一根是阳线
        if (first.close <= first.open) return null;

        // 第二根是小实体
        const secondBodySize = Math.abs(second.close - second.open);
        const firstBodySize = Math.abs(first.close - first.open);
        if (secondBodySize > firstBodySize * 0.5) return null;

        // 第三根是阴线，且收盘价低于第一根中点
        if (third.close >= third.open) return null;
        const midPoint = (first.open + first.close) / 2;
        if (third.close > midPoint) return null;

        // 计算置信度
        const confidence = Math.min(0.95, 0.7 + (first.close - third.close) / (first.close - first.open) * 0.25);

        return {
            pattern: '黄昏之星 🌆',
            confidence,
            signal: -1.5  // 强看跌信号
        };
    }

    /**
     * 识别吞没形态（Engulfing）
     * 看涨吞没: 第一根阴线 + 第二根阳线完全吞没
     * 看跌吞没: 第一根阳线 + 第二根阴线完全吞没
     */
    private static detectEngulfing(klines: any[]): PatternDetectionResult | null {
        if (klines.length < 2) return null;

        const prev = klines[klines.length - 2];
        const curr = klines[klines.length - 1];

        // 看涨吞没：前一根阴线，当前是阳线
        if (prev.close < prev.open && curr.close > curr.open) {
            if (curr.open < prev.close && curr.close > prev.open) {
                const confidence = Math.min(0.9, 0.6 + (curr.close - curr.open) / (prev.open - prev.close) * 0.3);
                return {
                    pattern: '看涨吞没 📈',
                    confidence,
                    signal: 1.2
                };
            }
        }

        // 看跌吞没：前一根阳线，当前是阴线
        if (prev.close > prev.open && curr.close < curr.open) {
            if (curr.open > prev.close && curr.close < prev.open) {
                const confidence = Math.min(0.9, 0.6 + (curr.open - curr.close) / (prev.close - prev.open) * 0.3);
                return {
                    pattern: '看跌吞没 📉',
                    confidence,
                    signal: -1.2
                };
            }
        }

        return null;
    }

    /**
     * 识别锤子线（Hammer）- 看涨反转
     * 1. 实体较小
     * 2. 下影线很长（最低价到开盘价 > 2倍实体）
     * 3. 上影线很短或无
     */
    private static detectHammer(klines: any[]): PatternDetectionResult | null {
        if (klines.length === 0) return null;

        const candle = klines[klines.length - 1];
        const bodySize = Math.abs(candle.close - candle.open);
        const totalHeight = candle.high - candle.low;
        const shadowLower = Math.max(candle.open, candle.close) - candle.low;
        const shadowUpper = candle.high - Math.max(candle.open, candle.close);

        // 实体相对较小（不超过1/3）
        if (bodySize > totalHeight / 3) return null;

        // 下影线很长（至少2倍实体）
        if (shadowLower < bodySize * 2) return null;

        // 上影线很短（少于实体大小）
        if (shadowUpper > bodySize * 0.5) return null;

        // 最好是阳线（看涨）
        const isWhiteCandle = candle.close > candle.open ? 1 : 0;

        const confidence = Math.min(0.85, 0.6 + shadowLower / totalHeight * 0.25);

        return {
            pattern: '锤子线 🔨',
            confidence,
            signal: isWhiteCandle ? 1.0 : 0.8  // 看涨反转
        };
    }

    /**
     * 识别倒锤子线（Inverse Hammer）- 看跌反转
     * 1. 实体较小
     * 2. 上影线很长（最高价到开盘价 > 2倍实体）
     * 3. 下影线很短或无
     */
    private static detectInverseHammer(klines: any[]): PatternDetectionResult | null {
        if (klines.length === 0) return null;

        const candle = klines[klines.length - 1];
        const bodySize = Math.abs(candle.close - candle.open);
        const totalHeight = candle.high - candle.low;
        const shadowUpper = candle.high - Math.min(candle.open, candle.close);
        const shadowLower = Math.min(candle.open, candle.close) - candle.low;

        // 实体相对较小
        if (bodySize > totalHeight / 3) return null;

        // 上影线很长
        if (shadowUpper < bodySize * 2) return null;

        // 下影线很短
        if (shadowLower > bodySize * 0.5) return null;

        // 最好是阴线（看跌）
        const isBlackCandle = candle.close < candle.open ? 1 : 0;

        const confidence = Math.min(0.85, 0.6 + shadowUpper / totalHeight * 0.25);

        return {
            pattern: '倒锤子线 ⚒️',
            confidence,
            signal: isBlackCandle ? -0.8 : -0.6  // 看跌反转
        };
    }
}
