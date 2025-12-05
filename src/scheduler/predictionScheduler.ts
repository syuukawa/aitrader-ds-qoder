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
     * 提高鲁抗性: 不管是执行错误还是APIg超时，都不会中断下一次执行。
     */
    private async executePrediction(): Promise<void> {
        if (this.isRunning) {
            console.log('⏳ Previous prediction cycle is still running, skipping this execution');
            return;
        }

        this.isRunning = true;
        this.executionCount++;
        const startTime = Date.now();
        let executionSuccess = false;
        let errorCount = 0;

        try {
            // Convert to Beijing time (UTC+8)
            const beijingDate = new Date(Date.now() + 8 * 60 * 60 * 1000);
            const timestamp = beijingDate.toISOString().replace('Z', '+08:00').slice(0, 19);
            console.log(`\n${'='.repeat(80)}`);
            console.log(`🔄 Execution #${this.executionCount} - ${timestamp}`);
            console.log(`${'='.repeat(80)}`);

            // Run market prediction with timeout protection
            console.log('📊 Starting market prediction with timeout protection (300s)...');
            const predictions = await this.executeWithTimeout(
                () => this.marketPredictor.predictMarket(),
                300000,  // 300 seconds = 5 minutes timeout
                'Market Prediction'
            );

            if (!predictions || predictions.length === 0) {
                console.log('⚠️  No symbols met the filtering criteria or no data available');
                // Even with no predictions, mark as success to continue next cycle
                executionSuccess = true;
                return;
            }

            // Try to export and report with error handling for each step
            try {
                // Print table view (all predictions)
                CSVExporter.printToConsole(predictions);
            } catch (error) {
                errorCount++;
                console.warn('⚠️  Failed to print table to console:', error);
            }

            try {
                // Export to CSV (all predictions)
                console.log('\n📊 Exporting results to CSV format...');
                CSVExporter.saveToFile(predictions, './output');
                console.log('✅ CSV export completed');
            } catch (error) {
                errorCount++;
                console.warn('⚠️  Failed to export to CSV:', error);
            }

            try {
                // Print summary (all predictions)
                const summary = CSVExporter.generateSummary(predictions);
                console.log('\n📈 Summary Statistics:');
                console.log('='.repeat(50));
                console.log(JSON.stringify(summary, null, 2));
                console.log('='.repeat(50));
            } catch (error) {
                errorCount++;
                console.warn('⚠️  Failed to generate summary:', error);
            }

            try {
                // Generate simplified report using SimplifiedReporter
                console.log('\n📋 Generating simplified market report...');
                const summaryData: SimplifiedSummary[] = predictions.map(p => {
                    // 获取OI趋势数据（如果存在）
                    const oiTrendData = p.technicalIndicators?.openInterestTrend;
                    
                    return {
                        symbol: p.symbol,
                        currentPrice: p.currentPrice,
                        signal: p.prediction || 'HOLD',
                        confidence: p.confidence || 0,
                        timestamp: p.timestamp,
                        // OI相关指标
                        oiTrend: oiTrendData?.trend,
                        oiStrength: oiTrendData?.strength,
                        oiGrowthRate: oiTrendData?.growthRate,
                        sumOpenInterestValue: p.sumOpenInterestValue
                    };
                });

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
            } catch (error) {
                errorCount++;
                console.warn('⚠️  Failed to generate or save report:', error);
            }

            executionSuccess = true;
            const duration = Math.round((Date.now() - startTime) / 1000);
            if (errorCount === 0) {
                console.log(`\n✅ Execution completed successfully in ${duration}s`);
            } else {
                console.log(`\n⚠️  Execution completed with ${errorCount} minor error(s) in ${duration}s (continue anyway)`);
            }
            console.log(`⏰ Next execution: ${this.getNextExecutionTime()}\n`);
        } catch (error) {
            executionSuccess = false;
            const duration = Math.round((Date.now() - startTime) / 1000);
            console.error(`\n❌ Execution #${this.executionCount} failed after ${duration}s:`, error);
            console.error('🔜 Detailed error:', error instanceof Error ? error.message : String(error));
            console.warn('⚠️  Will retry in next scheduled cycle (scheduler remains active)');
            console.log(`⏰ Next execution: ${this.getNextExecutionTime()}\n`);
        } finally {
            this.isRunning = false;
            // Log execution status for monitoring
            const status = executionSuccess ? '✅ SUCCESS' : '❌ FAILED';
            console.log(`[Execution Status] ${status} - Execution #${this.executionCount}`);
        }
    }

    /**
     * Execute an async function with timeout protection
     * 提供API超时保护，不会挣住整个程序
     */
    private executeWithTimeout<T>(
        fn: () => Promise<T>,
        timeoutMs: number,
        operationName: string
    ): Promise<T> {
        return Promise.race([
            fn(),
            new Promise<T>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`${operationName} timeout after ${timeoutMs}ms`)),
                    timeoutMs
                )
            )
        ]);
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