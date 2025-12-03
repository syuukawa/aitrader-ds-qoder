# DeepSeek AI Integration Guide

## Overview

The aitrader-ds-qoder project now includes comprehensive DeepSeek AI integration for advanced technical analysis and trading signal generation. This guide explains the architecture, implementation, and usage.

## Architecture

### Three Main Components

#### 1. **DeepSeekAnalyzer** (`src/analysis/deepseekAnalyzer.ts`)
The core AI analysis engine that communicates with DeepSeek API.

**Key Features:**
- Calls DeepSeek API for in-depth technical analysis
- Provides comprehensive indicator analysis (MACD, RSI, Moving Averages, Bollinger Bands, Volume)
- Generates trading signals with confidence scores
- Includes fallback/degradation logic when API is unavailable

**Main Methods:**
- `analyzeTrend()`: Performs complete trend analysis with AI
- `generateDetailedAnalysis()`: Calls DeepSeek API with formatted technical indicators
- `generateSimpleSignal()`: Local heuristic signal generation as backup
- `extractSignalFromAnalysis()`: Parses DeepSeek response for trading signal
- `extractConfidenceFromAnalysis()`: Extracts confidence score from analysis

#### 2. **SimplifiedReporter** (`src/analysis/simplifiedReporter.ts`)
Generates aggregated market reports in Markdown and JSON formats.

**Key Features:**
- Generates market summary reports
- Sorts signals by strength (BUY > HOLD > SELL)
- Calculates market sentiment and statistics
- Provides recommendations based on signal distribution

**Main Methods:**
- `generateMarkdownReport()`: Creates formatted Markdown report
- `generateJSONReport()`: Creates machine-readable JSON report
- `sortBySignalStrength()`: Sorts predictions by signal type and confidence
- `calculateStatistics()`: Analyzes market sentiment and trends

#### 3. **Enhanced MarketPredictor** (`src/prediction/marketPredictor.ts`)
Updated to integrate DeepSeek analysis into the prediction workflow.

**Integration Points:**
- Initializes `DeepSeekAnalyzer` when API key is provided
- Calls DeepSeek analysis for each predicted symbol
- Falls back to local analysis if API fails
- Extracts signal and confidence from AI analysis

**New Methods:**
- `getDeepSeekAnalysis()`: Async call to AI analysis with error handling
- `generateLocalAnalysis()`: Heuristic fallback when API unavailable
- `extractSignalFromAnalysis()`: Parse AI output for trading signal
- `extractConfidenceFromAnalysis()`: Extract confidence score

#### 4. **Enhanced PredictionScheduler** (`src/scheduler/predictionScheduler.ts`)
Integrated SimplifiedReporter for market analysis output.

**New Features:**
- Generates Markdown and JSON reports after each prediction cycle
- Saves reports to `./reports` directory
- Displays market sentiment and statistics
- Provides actionable trading recommendations

## Setup and Configuration

### Prerequisites

1. **DeepSeek API Key**
   - Obtain from https://api.deepseek.com
   - Set in `.env` file as `DEEPSEEK_API_KEY`

2. **Environment Variables** (`.env`)
   ```
   BINANCE_API_KEY=your_binance_api_key
   BINANCE_SECRET_KEY=your_binance_secret_key
   DEEPSEEK_API_KEY=your_deepseek_api_key
   DEEPSEEK_ENABLED=true
   DEEPSEEK_PROMPT_LOG=false  # Set to true for debugging
   ```

3. **Dependencies**
   ```bash
   npm install
   ```

### Optional: Proxy Configuration

If you need to use a proxy for API calls, edit `deepseekAnalyzer.ts`:

```typescript
const dispatcher = new ProxyAgent("http://127.0.0.1:7890");
setGlobalDispatcher(dispatcher);
```

## Workflow

### Complete Prediction Flow

```
1. PredictionScheduler.start()
   ├── Cron job triggers every 15 minutes
   └── executePrediction() called
       ├── MarketPredictor.predictMarket()
       │   ├── Get all 24h ticker data
       │   ├── Filter by volume and price change
       │   ├── Get K-line data for filtered symbols
       │   ├── Calculate technical indicators
       │   ├── For each symbol:
       │   │   ├── DeepSeekAnalyzer.analyzeTrend()
       │   │   │   ├── Call DeepSeek API with technical data
       │   │   │   ├── Extract signal and confidence
       │   │   │   └── Return analysis results
       │   │   └── Use local analysis as fallback if API fails
       │   └── Return PredictedSymbols array
       │
       ├── Filter to BUY signals only
       ├── Display results in console table
       ├── Export to CSV files
       ├── Generate summary statistics
       │
       └── SimplifiedReporter
           ├── Generate Markdown report
           ├── Generate JSON report
           ├── Save to ./reports directory
           └── Display market sentiment analysis
```

## DeepSeek API Integration Details

### Request Format

The analyzer sends technical indicators to DeepSeek in the following format:

```json
{
  "model": "deepseek-chat",
  "messages": [
    {
      "role": "user",
      "content": "...technical analysis prompt with indicators..."
    }
  ],
  "temperature": 0.7,
  "max_tokens": 1500
}
```

### Indicators Sent to DeepSeek

- **Current Price**: Real-time market price
- **MACD**: Moving Average Convergence Divergence (MACD value, signal line, histogram)
- **MA**: Moving Averages (MA5, MA10, MA20, MA50)
- **RSI**: Relative Strength Index
- **Bollinger Bands**: Upper, middle, lower bands with position
- **Volume**: Current, average, ratio, and trend

### DeepSeek Analysis Output

The AI provides detailed analysis including:

1. **Trend Analysis**: Short-term direction and strength
2. **Signal Verification**: Validates the automatic trading signal
3. **Key Levels**: Support and resistance positions
4. **Risk Assessment**: Risk-reward ratios
5. **Trading Recommendations**: Entry, stop-loss, take-profit levels

### Signal Extraction

The system extracts the trading signal using pattern matching:

- "强烈买入" or "强势买入" → **BUY**
- "买入" → **BUY**
- "持有" or "观望" → **HOLD**
- "卖出" → **SELL**
- "强烈卖出" or "强势卖出" → **SELL**

### Confidence Scoring

Confidence is determined by:

1. Explicit confidence statements in the analysis
2. Number of positive/negative indicators
3. Consistency of signals across timeframes
4. Analysis depth and certainty

## Report Generation

### Markdown Report (`trading_report_YYYY-MM-DD.md`)

Contains:
- Trading signal list with emojis
- Current prices and confidence scores
- Market sentiment analysis
- Bullish/bearish ratio
- Trading recommendations
- Signal distribution statistics

### JSON Report (`trading_report_YYYY-MM-DD.json`)

Contains machine-readable data:
- Timestamp
- Symbol count
- Individual signal data
- Aggregate statistics
- Market sentiment metrics

## Error Handling and Fallback

### Graceful Degradation

If DeepSeek API is unavailable or fails:

1. **Local Analysis Activated**: Uses heuristic-based signal generation
2. **Scoring System**:
   - MACD bullish/bearish indicators
   - RSI overbought/oversold conditions
   - Volume trend analysis
3. **Conservative Signals**: Lower confidence scores for local analysis
4. **User Notification**: Console logs indicate fallback mode

### Example Fallback Logic

```typescript
// When DeepSeek API fails
→ generateLocalAnalysis()
  ├── Calculate bullish/bearish scores
  ├── Evaluate MACD histogram and signal line
  ├── Check RSI zones (70=overbought, 30=oversold)
  ├── Analyze volume trends
  └── Generate signal with adjusted confidence
```

## Usage Examples

### Enable DeepSeek Analysis

In `src/index.ts`:

```typescript
const config: PredictionConfig = {
    minVolumeThreshold: 50_000_000,
    minPriceChangePercent: 5,
    klineInterval: '4h',
    klineLimit: 100,
    deepSeekEnabled: true,  // Enable AI analysis
    deepSeekApiKey: process.env.DEEPSEEK_API_KEY
};

const scheduler = new PredictionScheduler(
    binanceClient,
    config,
    process.env.DEEPSEEK_API_KEY
);
```

### Debug DeepSeek Prompts

Set environment variable to see prompts sent to DeepSeek:

```bash
export DEEPSEEK_PROMPT_LOG=true
npm start
```

## Output Examples

### Console Output

```
🔄 Execution #1 - 2025-12-02 15:30:00
================================================================================
📊 正在获取所有交易对的24小时数据...
📈 共获得 2000+ 个交易对的数据
🎯 筛选后得到 45 个符合条件的交易对
⏳ 正在处理 BNBUSDT...
✅ BNBUSDT - DeepSeek分析完成: BUY (置信度: 78%)

📊 Exporting BUY results to CSV format...

📋 Generating simplified market report...

# 📊 交易对监控简要报告

**生成时间**: 2025-12-02 15:30:45
**监控数量**: 12 个交易对

## 📋 交易对信号列表

| 序号 | 交易对 | 当前价格 | 交易信号 | 置信度 |
|------|--------|----------|----------|--------|
| 1 | BNBUSDT | 600.25000000 | 🟢 BUY | 78.0% |
| 2 | ETHUSDT | 2500.50000000 | 🟡 BUY | 65.0% |

## 📈 信号分布统计

### 信号分类统计
- **强烈买入 🟢**: 8 个交易对
- **买入 🟡**: 4 个交易对
- **持有 ⚪**: 2 个交易对
- **卖出 🟠**: 0 个交易对
- **强烈卖出 🔴**: 0 个交易对

### 市场情绪分析
- **看涨比例**: 85.7%
- **看跌比例**: 0.0%
- **市场热度**: 乐观 🟢🟢
- **建议操作**: 适度做多 🟡 (看涨超过60%)
```

## Key Metrics

### Technical Indicators Analyzed

| Indicator | Parameter | Use Case |
|-----------|-----------|----------|
| **MACD** | Histogram, Signal Line | Momentum detection |
| **RSI** | 14-period | Overbought/Oversold |
| **MA** | 5, 10, 20, 50-period | Trend confirmation |
| **Bollinger Bands** | Position, Bandwidth | Volatility & extremes |
| **Volume** | Current, Average, Ratio | Strength confirmation |

### Signal Confidence Factors

| Factor | Weight | Description |
|--------|--------|-------------|
| Indicator Alignment | +5% each | All indicators agree |
| MACD Confirmation | +2% | Histogram and signal align |
| Volume Support | +1% | Volume backs price move |
| MA Arrangement | +3% | Perfect vs partial arrangement |
| RSI Extremes | -5% | Warning for reversals |

## Performance Considerations

### API Rate Limits

- DeepSeek API: Standard rate limits apply
- Binance API: 1200 requests/minute
- Recommended: Stagger requests for 100+ symbols

### Optimization Tips

1. **Batch Processing**: Symbols processed in parallel batches
2. **Concurrent Limits**: Max 5 concurrent API calls per batch
3. **Caching**: Consider caching indicator calculations
4. **Proxy**: Use proxy for faster Chinese server access

### Estimated Execution Time

| Symbol Count | Without DeepSeek | With DeepSeek |
|--------------|------------------|---------------|
| 10 | ~5 seconds | ~30 seconds |
| 50 | ~25 seconds | ~180 seconds |
| 100 | ~50 seconds | ~300+ seconds |

## Troubleshooting

### Issue: "Cannot find module 'undici'"

**Solution**: Ensure undici is installed:
```bash
npm install undici@^5.29.0
```

### Issue: DeepSeek API timeout

**Solution**: 
- Check network connectivity
- Verify API key is valid
- Check rate limits
- Enable proxy if in restricted region

### Issue: Low confidence scores

**Solution**:
- Verify indicators are calculated correctly
- Check for conflicting signals
- Ensure timeframe is appropriate (4h+ recommended)

### Issue: Always returning HOLD signal

**Solution**:
- Check if indicators are properly initialized
- Verify MACD calculation
- Review threshold values in config

## Future Enhancements

1. **Multi-Timeframe Analysis**: Combine 1h, 4h, 1d analysis
2. **Pattern Recognition**: AI detects chart patterns
3. **News Integration**: Incorporate crypto news sentiment
4. **Custom Indicators**: User-defined indicator support
5. **Model Optimization**: Fine-tune for specific trading styles
6. **Backtesting**: Historical performance analysis

## References

- [DeepSeek API Documentation](https://api.deepseek.com/docs)
- [MACD Indicator](https://www.investopedia.com/terms/m/macd.asp)
- [RSI Indicator](https://www.investopedia.com/terms/r/rsi.asp)
- [Bollinger Bands](https://www.investopedia.com/terms/b/bollingerbands.asp)

## Support

For issues or questions:
1. Check logs with `DEEPSEEK_PROMPT_LOG=true`
2. Review error messages in console
3. Check `.env` configuration
4. Verify API keys and permissions
