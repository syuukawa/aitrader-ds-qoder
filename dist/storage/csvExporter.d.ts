import { PredictedSymbol } from '../prediction/types';
export declare class CSVExporter {
    private static toBeiJingTime;
    private static toBeiJingTimeISO;
    static toCsvString(predictions: PredictedSymbol[]): string;
    static saveToFile(predictions: PredictedSymbol[], outputDir?: string): string;
    static printToConsole(predictions: PredictedSymbol[]): void;
    static printCsvToConsole(predictions: PredictedSymbol[]): void;
    private static escapeCsvField;
    static generateSummary(predictions: PredictedSymbol[]): object;
}
//# sourceMappingURL=csvExporter.d.ts.map