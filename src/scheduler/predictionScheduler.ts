// src/scheduler/predictionScheduler.ts
// 预测调度器 - 使用Cron定时执行市场预测任务，每15分钟一次
import { CronJob } from 'cron';
import { MarketPredictor } from '../prediction/marketPredictor';
import { CSVExporter } from '../storage/csvExporter';
import { BinanceClient } from '../binance/client';
import { PredictionConfig } from '../prediction/types';
import { SimplifiedReporter, SimplifiedSummary } from '../analysis/simplifiedReporter';
import * as fs from 'fs';
import * as path from 'path';

// 预测调度器类
export class PredictionScheduler {
    private cronJob: CronJob | null = null; // Cron定时任务
    private marketPredictor: MarketPredictor; // 市场预测器实例
    private isRunning: boolean = false; // 当前是否有预测在运行
    private executionCount: number = 0; // 执行次数计数器

    constructor(
        binanceClient: BinanceClient,
        config: PredictionConfig,
        deepSeekApiKey?: string
    ) {
        this.marketPredictor = new MarketPredictor(
            binanceClient,
            config,
            deepSeekApiKey
        );
    }

    /**
     * Start the scheduler to run predictions every 15 minutes
     */
    start(): void {
        if (this.cronJob) {
            console.log('⚠️  Scheduler is already running');
            return;
        }

        console.log('🕐 Starting prediction scheduler (every 15 minutes)');
        console.log('⏰ Next execution: ' + this.getNextExecutionTime());

        // Create cron job that runs every 15 minutes
        this.cronJob = new CronJob('0 */15 * * * *', async () => {
            await this.executePrediction();
        });

        // Start the cron job
        this.cronJob.start();

        // Also run once immediately
        console.log('\n▶️  Running initial prediction...');
        this.executePrediction();
    }

    /**
     * 停止调度器
     */
    stop(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
            console.log('⚫ Prediction scheduler \u505c\u6b62\u4e86');
        } else {
            console.log('⚠️  \u8c03\u5ea6\u5668\u672a\u8fd0\u884c');
        }
    }

    /**
     * Execute a single prediction cycle
     */
    private async executePrediction(): Promise<void> {
        if (this.isRunning) {
            console.log('⏳ Previous prediction cycle is still running, skipping this execution');
            return;
        }

        this.isRunning = true;
        this.executionCount++;
        const startTime = Date.now();

        try {
            // Convert to Beijing time (UTC+8)
            const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
            const timestamp = beijingDate.toISOString().replace('Z', '+08:00').slice(0, 19);
            console.log(`\n${'='.repeat(80)}`);
            console.log(`🔄 Execution #${this.executionCount} - ${timestamp}`);
            console.log(`${'='.repeat(80)}`);

            // Run market prediction
            const predictions = await this.marketPredictor.predictMarket();

            if (predictions.length === 0) {
                console.log('⚠️  No symbols met the filtering criteria');
                return;
            }

            // Filter to only BUY predictions
            const buyPredictions = predictions.filter(p => p.prediction === 'BUY');

            if (buyPredictions.length === 0) {
                console.log('⚠️  No BUY signals found in predictions');
                return;
            }

            // Print table view (BUY only)
            CSVExporter.printToConsole(buyPredictions);

            // Export to CSV (BUY only)
            console.log('\n📊 Exporting BUY results to CSV format...');
            CSVExporter.saveToFile(buyPredictions, './output');

            // Print summary (BUY only)
            const summary = CSVExporter.generateSummary(buyPredictions);
            console.log('\n📈 Summary Statistics:');
            console.log('='.repeat(50));
            console.log(JSON.stringify(summary, null, 2));
            console.log('='.repeat(50));

            // Generate simplified report using SimplifiedReporter
            console.log('\n📋 Generating simplified market report...');
            const summaryData: SimplifiedSummary[] = buyPredictions.map(p => ({
                symbol: p.symbol,
                currentPrice: p.currentPrice,
                signal: p.prediction || 'HOLD',
                confidence: p.confidence || 0,
                timestamp: p.timestamp
            }));

            // Generate Markdown report
            const markdownReport = SimplifiedReporter.generateMarkdownReport(summaryData);
            console.log('\n' + markdownReport);

            // Save Markdown report to file
            const beijingDateForFile = new Date(Date.now() + 8 * 60 * 60 * 1000);
            const dateStr = beijingDateForFile.toISOString().split('T')[0];
            const reportDir = './reports';
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
            const reportPath = path.join(reportDir, `trading_report_${dateStr}.md`);
            fs.writeFileSync(reportPath, markdownReport);
            console.log(`\n💾 Markdown report saved to: ${reportPath}`);

            // Generate and save JSON report
            const jsonReport = SimplifiedReporter.generateJSONReport(summaryData);
            const jsonReportPath = path.join(reportDir, `trading_report_${dateStr}.json`);
            fs.writeFileSync(jsonReportPath, jsonReport);
            console.log(`💾 JSON report saved to: ${jsonReportPath}`);

            const duration = Math.round((Date.now() - startTime) / 1000);
            console.log(`\n✅ 执行完成，执行时间: ${duration}秒`);
            console.log(`⏰ 下一次执行: ${this.getNextExecutionTime()}\n`);
        } catch (error) {
            console.error('❌ 预测执行出错:', error);
        } finally {
            this.isRunning = false;
        }
    }

    /**
     * 获取下一次执行时间
     */
    private getNextExecutionTime(): string {
        if (!this.cronJob) {
            return 'N/A';
        }
        const nextDate = this.cronJob.nextDate();
        if (nextDate && typeof nextDate.toString === 'function') {
            return nextDate.toString();
        }
        return 'N/A';
    }

    /**
     * 检查调度器是否还在运行
     */
    isSchedulerRunning(): boolean {
        return this.cronJob !== null;
    }

    /**
     * 获取执行统计信息
     */
    getStats(): object {
        return {
            isRunning: this.isRunning,
            isSchedulerRunning: this.isSchedulerRunning(),
            executionCount: this.executionCount,
            nextExecution: this.getNextExecutionTime()
        };
    }
}