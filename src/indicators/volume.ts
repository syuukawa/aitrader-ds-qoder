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

        return {
            currentVolume,
            averageVolume: avgVolume,
            volumeRatio: currentVolume / avgVolume,
            volumeTrend: this.calculateVolumeTrend(volumes, trendPeriods)
        };
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