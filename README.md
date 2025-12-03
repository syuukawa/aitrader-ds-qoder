# AI Trader with Market Prediction (DS-Qoder)

AI-powered cryptocurrency trading system with market prediction capabilities for Binance Futures.

## Features

- **Multi-layered Architecture**: Clean separation of concerns with modular design
- **Concurrent Processing**: Uses worker threads for efficient data processing
- **Technical Analysis**: Comprehensive indicator calculations (MACD, RSI, Bollinger Bands, etc.)
- **Smart Filtering**: Filters symbols based on volume and price change criteria
- **Extensible Design**: Easy to add new indicators or analysis methods
- **Error Handling**: Robust error handling with retry mechanisms

## Architecture

The system follows a 6-stage pipeline:

1. **Data Collection**: Fetch open interest history via `/futures/data/openInterestHist`
2. **Filtering**: Apply filters based on 24-hour price change (>5%) and volume (>50M USDT)
3. **K-line Retrieval**: Get K-line data (15m, 200 bars)
4. **Indicator Computation**: Calculate technical indicators (MACD, RSI, Bollinger Bands, etc.)
5. **Signal Fusion**: Combine indicators with weighted scoring
6. **Prediction Output**: Generate final predictions with confidence assessment

## Project Structure

```
src/
├── binance/              # Binance API client
│   ├── client.ts
│   └── types.ts
├── indicators/           # Technical indicator calculations
│   ├── basicIndicators.ts
│   ├── indicatorCalculator.ts
│   ├── macd.ts
│   └── volume.ts
├── prediction/           # Market prediction engine
│   ├── marketPredictor.ts
│   └── types.ts
└── index.ts              # Application entry point
```

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory:

```env
DEEPSEEK_API_KEY=your_deepseek_api_key_here
```

## Usage

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## Technical Details

### Concurrency & Performance

- Uses worker threads for concurrent symbol processing
- Implements retry mechanisms for API calls
- Batches symbol processing to prevent resource exhaustion
- Configurable concurrency limits

### Data Processing

- Fetches 24hr ticker data for all symbols
- Filters symbols based on volume (>50M USDT) and price change (>5%)
- Retrieves 15-minute K-line data for the last 200 periods
- Calculates multiple technical indicators
- Sorts results by confidence or volume

### Indicator Calculations

- **Trend Indicators**: MACD (12,26,9), Moving Averages (5,10,20,50)
- **Oscillators**: RSI (14-period)
- **Volatility**: Bollinger Bands (20-period, 2x multiplier)
- **Volume**: Volume profile and trend analysis

## Extending the System

### Adding New Indicators

1. Create a new file in the `indicators/` directory
2. Implement the calculation logic
3. Add the indicator to `IndicatorCalculator.calculateAllIndicators()`

### Adding New Filters

1. Modify the `getFilteredSymbols()` method in `MarketPredictor`
2. Add new filter criteria to the configuration

### Adding DeepSeek Integration

The system includes a placeholder for DeepSeek AI analysis. To implement:
1. Replace the `getDeepSeekAnalysis()` method with actual API calls
2. Construct appropriate prompts with technical indicator data
3. Parse the AI response for trading signals

## Error Handling

- Implements retry mechanisms for API calls
- Gracefully handles missing or incomplete data
- Continues processing other symbols when individual symbol processing fails
- Provides detailed error logging for debugging

## Performance Considerations

- Limits concurrent worker threads to prevent API rate limiting
- Uses efficient data structures for indicator calculations
- Implements caching where appropriate
- Batches API calls to reduce network overhead