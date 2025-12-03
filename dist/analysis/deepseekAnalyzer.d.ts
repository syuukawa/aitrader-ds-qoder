interface IndicatorAnalysis {
    currentPrice: number;
    macd: any;
    volume: any;
    rsi: number;
    ma: any;
    bollingerBands: any;
    priceData?: any;
}
export declare class DeepSeekAnalyzer {
    private apiKey;
    private baseURL;
    constructor(apiKey: string);
    analyzeTrend(indicators: IndicatorAnalysis, symbol: string): Promise<{
        summary: string;
        analysis: string;
        fullReport: string;
    }>;
    private generateSummaryOutput;
    private generateDetailedAnalysis;
    private buildAnalysisPrompt;
    private generateSimpleSignal;
    private analyzeMACDStatus;
    private getMAPosition;
    private analyzeMAArrangement;
    private analyzeBollingerStatus;
    private analyzeVolumeStatus;
    private analyzeRSIStatus;
    private getFallbackAnalysis;
}
export {};
//# sourceMappingURL=deepseekAnalyzer.d.ts.map