import { BinanceClient } from '../binance/client';
import { PredictionConfig } from '../prediction/types';
export declare class PredictionScheduler {
    private cronJob;
    private marketPredictor;
    private isRunning;
    private executionCount;
    constructor(binanceClient: BinanceClient, config: PredictionConfig, deepSeekApiKey?: string);
    start(): void;
    stop(): void;
    private executePrediction;
    private getNextExecutionTime;
    isSchedulerRunning(): boolean;
    getStats(): object;
}
//# sourceMappingURL=predictionScheduler.d.ts.map