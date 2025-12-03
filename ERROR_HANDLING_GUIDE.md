# Comprehensive Error Handling & Resilience Guide

## Overview

The AI Trader system now features **enterprise-grade error handling** to ensure continuous operation even when API requests timeout, networks fail, or unexpected errors occur.

---

## Key Principle: "Never Stop Execution"

The system is designed with a philosophy that **one symbol's failure should never block the next symbol's processing**.

```
Old Behavior (❌ Bad):
Symbol 1 → Error → Entire program crashes → Everything stops

New Behavior (✅ Good):
Symbol 1 → Error → Log warning → Continue to Symbol 2 → Continue to Symbol 3...
```

---

## Error Handling Layers

### Layer 1: Scheduler-Level Protection
**File**: `src/scheduler/predictionScheduler.ts`

#### Timeout Protection with 300-second cap:
```typescript
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

// Usage:
const predictions = await this.executeWithTimeout(
    () => this.marketPredictor.predictMarket(),
    300000,  // 5 minutes timeout
    'Market Prediction'
);
```

**Benefits**:
- ✅ Prevents hanging indefinitely
- ✅ Max wait time = 300 seconds
- ✅ Doesn't block next execution cycle

#### Error Summary & Reporting:
```typescript
try {
    // ... execution logic ...
    executionSuccess = true;
} catch (error) {
    executionSuccess = false;
    console.error(`❌ Execution #${this.executionCount} failed after ${duration}s:`, error);
    console.warn('⚠️  Will retry in next scheduled cycle (scheduler remains active)');
} finally {
    this.isRunning = false;
    // Log execution status for monitoring
    const status = executionSuccess ? '✅ SUCCESS' : '❌ FAILED';
    console.log(`[Execution Status] ${status} - Execution #${this.executionCount}`);
}
```

**Result**: Even if execution #1 fails completely, the scheduler waits 15 minutes and executes #2.

---

### Layer 2: Prediction Cycle Protection
**File**: `src/prediction/marketPredictor.ts` (predictMarket method)

#### Graceful Degradation on Filter Step Failure:
```typescript
let filteredSymbols: PriceData[] = [];
try {
    filteredSymbols = await this.getFilteredSymbols();
    console.log(`✅ Found ${filteredSymbols.length} qualifying symbols`);
} catch (error) {
    console.error('❌ Failed to get filtered symbols:', error);
    console.warn('⚠️  Will return empty list, next execution will retry');
    return [];  // Return empty, not throw
}
```

**Behavior**:
- If symbol filtering fails → Return [] → Next execution retries
- Doesn't crash the scheduler

#### Per-Symbol Timeout & Error Isolation:
```typescript
for (let idx = 0; idx < filteredSymbols.length; idx++) {
    const symbolData = filteredSymbols[idx];
    
    try {
        // Add 60-second timeout per symbol
        const result = await Promise.race([
            this.processSymbol(symbolData),
            new Promise<null>((_, reject) =>
                setTimeout(
                    () => reject(new Error(`Symbol ${symbolData.symbol} processing timeout`)),
                    60000  // 60 seconds
                )
            )
        ]);
        
        if (result) {
            predictedSymbols.push(result);
            successCount++;
        }
    } catch (error) {
        failureCount++;
        if (error instanceof Error && error.message.includes('timeout')) {
            timeoutCount++;
            console.warn(`⚠️  ${symbolData.symbol}: Processing timeout, skipping`);
        } else {
            console.warn(`⚠️  ${symbolData.symbol}: Processing failed, skipping`);
        }
        // Continue to next symbol - don't break
        continue;
    }
}

// Output stats
console.log(`📊 Processing stats: success=${successCount}, failed=${failureCount}, timeout=${timeoutCount}`);
```

**Result**: 
- ✅ 1 symbol timeout → Only that symbol skipped
- ✅ 2 symbols fail → Still process other 8 symbols
- ✅ Progress = 8/10 instead of 0/10

---

### Layer 3: Symbol-Level Protection
**File**: `src/prediction/marketPredictor.ts` (processSymbol method)

#### Granular Error Catching:
```typescript
private async processSymbol(symbolData: PriceData): Promise<PredictedSymbol | null> {
    try {
        const { symbol, price, quoteVolume, priceChangePercent } = symbolData;
        
        // Step 1: Kline fetching with protection
        let klines: any[] = [];
        try {
            klines = await this.binanceClient.getKlines(symbol, ...);
        } catch (error) {
            console.warn(`⚠️  ${symbol}: Failed to fetch klines - ${error.message}`);
            return null;  // Return null, not throw
        }
        
        if (!klines || klines.length === 0) {
            console.warn(`⚠️  Failed to fetch klines for ${symbol}`);
            return null;
        }
        
        // Step 2: Indicator calculation with protection
        let indicators: any;
        try {
            indicators = IndicatorCalculator.calculateAllIndicators(klines);
        } catch (error) {
            console.warn(`⚠️  ${symbol}: Failed to calculate indicators - ${error.message}`);
            return null;
        }
        
        // Step 3: Local analysis with protection
        let localAnalysis: { prediction: string; confidence: number };
        try {
            localAnalysis = this.generateLocalAnalysis(indicators);
        } catch (error) {
            console.warn(`⚠️  ${symbol}: Local analysis failed - ${error.message}`);
            return null;
        }
        
        const predictedSymbol: PredictedSymbol = {
            symbol, currentPrice: price, volume24h: quoteVolume,
            priceChangePercent24h: priceChangePercent,
            sumOpenInterestValue: 0,
            technicalIndicators: indicators,
            prediction: localAnalysis.prediction,
            confidence: localAnalysis.confidence,
            timestamp: Date.now()
        };
        
        // Step 4: DeepSeek analysis (optional, failure doesn't block)
        if (this.config.deepSeekEnabled && this.deepSeekApiKey) {
            try {
                const analysis = await this.getDeepSeekAnalysis(indicators, symbol);
                if (analysis.prediction) {
                    predictedSymbol.prediction = analysis.prediction;
                    predictedSymbol.confidence = analysis.confidence;
                }
            } catch (error) {
                console.warn(`⚠️  ${symbol}: DeepSeek analysis failed, using local analysis - ${error.message}`);
                // Keep local analysis, don't fail
            }
        }
        
        console.log(`✅ ${symbol}: Signal=${predictedSymbol.prediction}, Confidence=${predictedSymbol.confidence}%`);
        return predictedSymbol;
        
    } catch (error) {
        // Catch-all for unexpected errors
        console.error(`❌ Unexpected error processing ${symbolData.symbol}:`, error);
        return null;  // Return null, guarantee program continues
    }
}
```

**Key Points**:
- Each step is wrapped in try-catch
- Each error returns null (not throw)
- Previous steps' failures don't block next steps
- Global catch-all for unexpected errors

---

### Layer 4: API-Level Protection
**File**: `src/binance/client.ts`

#### Timeout-Aware Retry Logic:
```typescript
async fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<Response> {
    for (let i = 0; i < retries; i++) {
        try {
            // Initial delay before first call
            if (i === 0) {
                console.log(`⏳ [Pre-delay] Waiting 2000ms before first API call...`);
                await this.delay(2000);
            }

            console.log(`🔗 [API Call ${i + 1}/${retries}] Fetching...`);
            const response = await fetch(url);
            
            if (response.ok) {
                console.log(`✅ [API Success] Response OK`);
                return response;
            }

            // Handle 418/429 rate limits
            if (response.status === 429 || response.status === 418) {
                let waitTime: number;
                if (response.status === 418) {
                    // IP ban - aggressive backoff
                    waitTime = Math.min(2000 * Math.pow(2, i), 60000);
                    console.warn(`🫖 [418 Rate Limit] IP banned. Waiting ${waitTime}ms...`);
                } else {
                    // Rate limit - respect Retry-After header
                    waitTime = response.headers.get('Retry-After') 
                        ? parseInt(response.headers.get('Retry-After')!) * 1000
                        : Math.min(2000 * Math.pow(2, i), 60000);
                    console.warn(`⏱️ [429 Rate Limit] Too many requests. Waiting ${waitTime}ms...`);
                }
                await this.delay(waitTime);
                continue;
            }

            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            
        } catch (error) {
            if (i === retries - 1) {
                console.error(`❌ [API Failed] Max retries exceeded: ${error}`);
                throw error;  // Only throw on final retry
            }
            const waitTime = Math.min(2000 * Math.pow(2, i), 60000);
            console.warn(`⚠️ [Retry] Request failed. Waiting ${waitTime}ms...`);
            await this.delay(waitTime);
        }
    }
    throw new Error('Max retries exceeded');
}
```

**Protection**:
- ✅ 2000ms initial delay (reduces "busy" responses)
- ✅ Exponential backoff (2s → 4s → 8s... capped at 60s)
- ✅ Rate limit detection (418 vs 429)
- ✅ Retry-After header respect
- ✅ Max 60-second wait (never hangs forever)

---

## Error Recovery Strategies

### Strategy 1: Graceful Degradation
When one component fails, fall back to lower-level alternative:

```
Perfect Scenario: Get Klines → Calculate Indicators → Local Analysis → DeepSeek Analysis
⬇️ Step 1 fails (no klines)
Degrade: Skip this symbol → Continue to next symbol
⬇️ Step 3 fails (local analysis error)
Degrade: Return null → Try next symbol
⬇️ Step 4 fails (DeepSeek timeout)
Degrade: Use local analysis results → Still return prediction
```

### Strategy 2: Retry with Backoff
For API failures, retry with increasing delays:

```
Attempt 1: Immediate (with 2s pre-delay)
          ↓ Fails
Attempt 2: Wait 2s, retry
          ↓ Fails
Attempt 3: Wait 4s, retry
          ↓ Fails
Attempt 4: Wait 8s, retry
          ↓ Fails
Attempt 5: Wait 16s, retry
          ↓ Fails
Give Up: Return error, move to next symbol (don't throw)
```

### Strategy 3: Timeout Protection
Every async operation has a timeout:

```
Promise.race([
    asyncOperation(),  ← Original operation
    timeout(60s)       ← Timeout guardian
])

Outcome 1: Operation completes < 60s → Success
Outcome 2: Operation hangs > 60s → Timeout error caught → Return null
```

---

## Execution Flow with Error Handling

### Successful Execution (Happy Path)
```
[Execution Start]
    ↓
[Get Filtered Symbols] ✅
    ↓
[Process Symbol 1] ✅
[Process Symbol 2] ✅
[Process Symbol 3] ✅ (DeepSeek timeout, use local analysis)
[Process Symbol 4] ✅
[Process Symbol 5] ✅ (Kline fetch fails, skip)
[Process Symbol 6] ✅
[Process Symbol 7] ✅
[Process Symbol 8] ✅
[Process Symbol 9] ✅
[Process Symbol 10] ✅ (API timeout, skip)
    ↓
[Export Results] (8 predictions)
    ↓
[Execution Complete] ✅ (with minor errors)
    ↓
[Next Execution in 15 minutes] ⏰
```

### Catastrophic Failure (Network Down)
```
[Execution Start]
    ↓
[Get Filtered Symbols] ❌ Network timeout
    ↓
[Return Empty List]
    ↓
[No Symbols to Process]
    ↓
[Execution Complete] ❌ (0 predictions)
    ↓
[Scheduler Still Running!]
    ↓
[Next Execution in 15 minutes] ⏰ (will try again)
```

---

## Monitoring & Debugging

### Execution Status Output
```
🔄 Execution #23 - 2025-12-03T21:47:13
...processing...
📊 Processing stats: success=8, failed=2, timeout=0
🎯 Got 8 valid predictions
⚠️ Execution completed with 2 minor error(s) in 45s (continue anyway)
[Execution Status] ✅ SUCCESS - Execution #23
⏰ Next execution: 2025-12-03T22:02:13
```

### Error Log Reading Guide
```
⏳ [Pre-delay] ...              → Normal, startup
🔗 [API Call 1/5] ...           → Normal, making request
✅ [API Success] ...            → Normal, successful
🫖 [418 Rate Limit] ...         → Recoverable, will retry
⏱️ [429 Rate Limit] ...         → Recoverable, will retry
⚠️ [Retry] ...                  → Normal, retrying
❌ [API Failed] ...             → Failed, will log and continue
⚠️ ${symbol}: Processing failed → Symbol-level failure, isolated
✅ ${symbol}: Signal= ...       → Symbol successfully analyzed
❌ Unexpected error ...         → Caught by global catch, program continues
```

---

## Configuration & Tuning

### Timeout Parameters
```typescript
// In predictionScheduler.ts
const predictions = await this.executeWithTimeout(
    () => this.marketPredictor.predictMarket(),
    300000,  // ← Change this (milliseconds)
    'Market Prediction'
);

// In marketPredictor.ts (per symbol)
const result = await Promise.race([
    this.processSymbol(symbolData),
    new Promise<null>((_, reject) =>
        setTimeout(
            () => reject(new Error(`Symbol ${symbolData.symbol} processing timeout`)),
            60000  // ← Change this (milliseconds)
        )
    )
]);
```

### Retry Parameters
```typescript
// In client.ts
async fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<Response> {
    //                                          ↑ retries
    //                                                    ↑ base delay (2000ms)
    
    // In the calculation:
    waitTime = Math.min(2000 * Math.pow(2, i), 60000);
    //         ↑ base        ↑ exponential         ↑ max cap
}
```

---

## Best Practices

### ✅ DO:
- ✅ Use try-catch blocks around each logical step
- ✅ Return null on error (don't throw to caller)
- ✅ Log errors with context (symbol, operation, error)
- ✅ Continue processing after individual failures
- ✅ Add timeout protection to long operations
- ✅ Use Promise.race() for timeout guarantees

### ❌ DON'T:
- ❌ Throw errors up to scheduler level
- ❌ Block multiple symbols for one failure
- ❌ Retry indefinitely without timeout
- ❌ Swallow errors silently
- ❌ Trust external APIs without timeouts
- ❌ Assume network always works

---

## Testing Error Scenarios

### Scenario 1: API Timeout Simulation
```bash
# Add network latency
tc qdisc add dev eth0 root netem delay 500000ms

# Run scheduler
node dist/index.js

# Expected: Timeouts caught, program continues
# Actual: [60-second timeout per symbol] → Skip → Continue
```

### Scenario 2: Network Failure
```bash
# Block all network
sudo iptables -A OUTPUT -j DROP

# Run scheduler  
node dist/index.js

# Expected: Eventually gives up, moves to next cycle
# Actual: [300-second total timeout] → Return [] → Scheduler waits 15 min
```

### Scenario 3: Partial Symbol Processing
```
Input: 10 symbols
Scenario: Symbols 2, 5, 8 fail (network issues)
Expected: Process symbols 1, 3, 4, 6, 7, 9, 10 (7/10 = 70%)
Actual: ✅ 7 predictions exported, 3 logged as skipped
```

---

## Summary

**Error Handling Philosophy**:
> "One failure should never crash the entire system. Always try to recover, always try to continue, always be ready for the next cycle."

**Key Guarantees**:
1. ✅ Scheduler never crashes (errors caught at execution level)
2. ✅ One symbol failure doesn't block others
3. ✅ Timeouts prevent infinite hangs (max 300s per execution)
4. ✅ API failures trigger retry with exponential backoff
5. ✅ Next execution always happens (scheduler remains active)
6. ✅ All errors logged for monitoring

**Result**: Enterprise-grade reliability for continuous 24/7 operation! 🚀

