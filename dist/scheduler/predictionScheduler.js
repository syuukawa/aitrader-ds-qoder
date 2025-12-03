"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PredictionScheduler = void 0;
const cron_1 = require("cron");
const marketPredictor_1 = require("../prediction/marketPredictor");
const csvExporter_1 = require("../storage/csvExporter");
const simplifiedReporter_1 = require("../analysis/simplifiedReporter");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class PredictionScheduler {
    constructor(binanceClient, config, deepSeekApiKey) {
        this.cronJob = null;
        this.isRunning = false;
        this.executionCount = 0;
        this.marketPredictor = new marketPredictor_1.MarketPredictor(binanceClient, config, deepSeekApiKey);
    }
    start() {
        if (this.cronJob) {
            console.log('⚠️  Scheduler is already running');
            return;
        }
        console.log('🕐 Starting prediction scheduler (every 15 minutes)');
        console.log('⏰ Next execution: ' + this.getNextExecutionTime());
        this.cronJob = new cron_1.CronJob('0 */15 * * * *', async () => {
            await this.executePrediction();
        });
        this.cronJob.start();
        console.log('\n▶️  Running initial prediction...');
        this.executePrediction();
    }
    stop() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('⚫ Prediction scheduler \u505c\u6b62\u4e86');
        }
        else {
            console.log('⚠️  \u8c03\u5ea6\u5668\u672a\u8fd0\u884c');
        }
    }
    async executePrediction() {
        if (this.isRunning) {
            console.log('⏳ Previous prediction cycle is still running, skipping this execution');
            return;
        }
        this.isRunning = true;
        this.executionCount++;
        const startTime = Date.now();
        try {
            const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
            const timestamp = beijingDate.toISOString().replace('Z', '+08:00').slice(0, 19);
            console.log(`\n${'='.repeat(80)}`);
            console.log(`🔄 Execution #${this.executionCount} - ${timestamp}`);
            console.log(`${'='.repeat(80)}`);
            const predictions = await this.marketPredictor.predictMarket();
            if (predictions.length === 0) {
                console.log('⚠️  No symbols met the filtering criteria');
                return;
            }
            const buyPredictions = predictions.filter(p => p.prediction === 'BUY');
            if (buyPredictions.length === 0) {
                console.log('⚠️  No BUY signals found in predictions');
                return;
            }
            csvExporter_1.CSVExporter.printToConsole(buyPredictions);
            console.log('\n📊 Exporting BUY results to CSV format...');
            csvExporter_1.CSVExporter.saveToFile(buyPredictions, './output');
            const summary = csvExporter_1.CSVExporter.generateSummary(buyPredictions);
            console.log('\n📈 Summary Statistics:');
            console.log('='.repeat(50));
            console.log(JSON.stringify(summary, null, 2));
            console.log('='.repeat(50));
            console.log('\n📋 Generating simplified market report...');
            const summaryData = buyPredictions.map(p => ({
                symbol: p.symbol,
                currentPrice: p.currentPrice,
                signal: p.prediction || 'HOLD',
                confidence: p.confidence || 0,
                timestamp: p.timestamp
            }));
            const markdownReport = simplifiedReporter_1.SimplifiedReporter.generateMarkdownReport(summaryData);
            console.log('\n' + markdownReport);
            const beijingDateForFile = new Date(Date.now() + 8 * 60 * 60 * 1000);
            const dateStr = beijingDateForFile.toISOString().split('T')[0];
            const reportDir = './reports';
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
            const reportPath = path.join(reportDir, `trading_report_${dateStr}.md`);
            fs.writeFileSync(reportPath, markdownReport);
            console.log(`\n💾 Markdown report saved to: ${reportPath}`);
            const jsonReport = simplifiedReporter_1.SimplifiedReporter.generateJSONReport(summaryData);
            const jsonReportPath = path.join(reportDir, `trading_report_${dateStr}.json`);
            fs.writeFileSync(jsonReportPath, jsonReport);
            console.log(`💾 JSON report saved to: ${jsonReportPath}`);
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.log(`\n✅ 执行完成，执行时间: ${duration}秒`);
            console.log(`⏰ 下一次执行: ${this.getNextExecutionTime()}\n`);
        }
        catch (error) {
            console.error('❌ 预测执行出错:', error);
        }
        finally {
            this.isRunning = false;
        }
    }
    getNextExecutionTime() {
        if (!this.cronJob) {
            return 'N/A';
        }
        const nextDate = this.cronJob.nextDate();
        if (nextDate && typeof nextDate.toString === 'function') {
            return nextDate.toString();
        }
        return 'N/A';
    }
    isSchedulerRunning() {
        return this.cronJob !== null;
    }
    getStats() {
        return {
            isRunning: this.isRunning,
            isSchedulerRunning: this.isSchedulerRunning(),
            executionCount: this.executionCount,
            nextExecution: this.getNextExecutionTime()
        };
    }
}
exports.PredictionScheduler = PredictionScheduler;
//# sourceMappingURL=predictionScheduler.js.map