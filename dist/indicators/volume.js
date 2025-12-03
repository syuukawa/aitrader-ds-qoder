"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VolumeAnalyzer = void 0;
class VolumeAnalyzer {
    static calculateVolumeProfile(volumes, prices, periods = 20, trendPeriod) {
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
    static calculateVolumeTrend(volumes, trendPeriods) {
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
exports.VolumeAnalyzer = VolumeAnalyzer;
//# sourceMappingURL=volume.js.map