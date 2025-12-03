import { BinanceClient } from '../binance/client';
import { PredictionConfig, PredictedSymbol } from './types';
export declare class MarketPredictor {
    private binanceClient;
    private config;
    private deepSeekApiKey?;
    private deepSeekAnalyzer?;
    private excludedPairs;
    constructor(binanceClient: BinanceClient, config: PredictionConfig, deepSeekApiKey?: string);
    private loadExcludedPairs;
    predictMarket(): Promise<PredictedSymbol[]>;
    private getFilteredSymbols;
    private processSymbol;
    private getDeepSeekAnalysis;
    private generateLocalAnalysis;
    private extractSignalFromAnalysis;
    private extractConfidenceFromAnalysis;
}
//# sourceMappingURL=marketPredictor.d.ts.map