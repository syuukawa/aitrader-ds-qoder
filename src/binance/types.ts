// src/binance/types.ts

export interface OpenInterestStatisticsParams {
    symbol: string;           // e.g., "BTCUSD" - note: uses 'pair' not 'symbol'
    // contractType: string;   // "ALL", "CURRENT_QUARTER", "NEXT_QUARTER", "PERPETUAL"
    period: string;         // "5m", "15m", "30m", "1h", "2h", "4h", "6h", "12h", "1d"
    startTime?: number;
    endTime?: number;
    limit?: number;         // Default 30, Max 500
}

export interface OpenInterestData {
    symbol: string;
    sumOpenInterest: string; // 持仓总数量
    sumOpenInterestValue: string; // 持仓总价值USDT
    timestamp: number; //时间戳
}

export interface PriceData {
    symbol: string;
    price: number;
    priceChangePercent: number;
    // volume: number;
    quoteVolume: number; //24小时成交额
    timestamp: number;
}

export interface Kline {
    date: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}