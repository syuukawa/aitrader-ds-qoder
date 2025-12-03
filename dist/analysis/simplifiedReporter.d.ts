export interface SimplifiedSummary {
    symbol: string;
    currentPrice: number;
    signal: string;
    confidence: number;
    timestamp: number;
}
export declare class SimplifiedReporter {
    static generateMarkdownReport(summaries: SimplifiedSummary[]): string;
    static generateJSONReport(summaries: SimplifiedSummary[]): string;
    private static sortBySignalStrength;
    private static getSignalEmoji;
    private static generateStatistics;
    private static calculateStatistics;
}
//# sourceMappingURL=simplifiedReporter.d.ts.map