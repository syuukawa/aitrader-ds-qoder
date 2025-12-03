# Error Handling Quick Reference

## One-Sentence Summary
**"Any single failure is caught and isolated; the system continues processing other symbols and retries on the next 15-minute cycle."**

---

## Key Architecture

```
Scheduler (15-minute cycles)
    ↓
Execution (300s max timeout per cycle)
    ↓
Symbol Prediction (60s max timeout per symbol)
    ↓
Processing Steps (Klines → Indicators → Analysis → DeepSeek)
    ↓
API Calls (Exponential backoff, max 60s wait)
```

---

## Error Handling Layers

| Layer | Timeout | Failure Behavior |
|-------|---------|------------------|
| **API Calls** | 60s max (backoff) | Retry up to 5 times, then fail |
| **Per-Symbol** | 60s max | Timeout → Skip symbol → Continue |
| **Prediction Cycle** | 300s max | Timeout → Log error → Retry next |
| **Scheduler** | Forever | Never crashes, always waiting |

---

## Quick Troubleshooting

### Problem: Slow Execution
```
Expected: Should finish in 2-5 minutes
Actual: Takes 15+ minutes
Cause: Likely API delays or network issues
Solution: Check console for timeout warnings, they're normal
```

### Problem: No Predictions Generated
```
Expected: At least some symbols should be processed
Actual: 0 predictions
Cause: All symbols failed or network down
Solution: Check next execution in 15 minutes, it will retry
```

### Problem: Some Symbols Missing
```
Expected: All 10 symbols processed
Actual: Only 8/10 symbols
Cause: 2 symbols hit timeouts or API errors
Solution: They'll retry next cycle, this is normal
```

### Problem: "Symbol timeout" Warnings
```
Normal?: YES, these are expected
Meaning: That symbol took >60s to process
Action: It's skipped, will retry next cycle
Ignore?: Safe to ignore, no action needed
```

---

## Console Output Guide

```
✅ [API Success]        → Great! API call succeeded
⏳ [Pre-delay]          → Normal, waiting before API call
🔗 [API Call]           → Normal, making request
🫖 [418 Rate Limit]     → Recoverable, will retry
⏱️ [429 Rate Limit]     → Recoverable, will retry
⚠️ [Retry]              → Recovering from error
❌ [API Failed]         → API gave up after 5 retries
⚠️ [symbol]: timeout    → Symbol hit 60s timeout, skipped
⚠️ [symbol]: failed     → Symbol processing failed, skipped
✅ [symbol]: Signal=    → Symbol successfully processed
❌ Unexpected error     → Unexpected error (rare), caught and logged
[Execution Status]      → Final result of entire cycle
```

---

## Real-World Examples

### Example 1: Normal Execution
```
🔄 Execution #10 - 2025-12-03T21:45:00
  Processing 8 symbols...
  ✅ BTC: Signal=BUY, Confidence=85%
  ✅ ETH: Signal=HOLD, Confidence=60%
  ⚠️ SOL: Timeout, skipped
  ✅ ADA: Signal=BUY, Confidence=75%
  ✅ DOT: Signal=SELL, Confidence=70%
  ✅ XRP: Signal=HOLD, Confidence=55%
  ✅ LTC: Signal=BUY, Confidence=80%
  ✅ BNB: Signal=SELL, Confidence=65%
  ⚠️ AVA: Failed, skipped
  ✅ FTT: Signal=HOLD, Confidence=60%
📊 Stats: success=8, failed=1, timeout=1
[Execution Status] ✅ SUCCESS - Execution #10
⏰ Next execution: 22:00:00 (in 15 minutes)
```

### Example 2: Network Issue
```
🔄 Execution #11 - 2025-12-03T22:00:00
❌ Network error while fetching symbols
⚠️ Will return empty list, next execution will retry
[Execution Status] ❌ FAILED - Execution #11
⏰ Next execution: 22:15:00 (in 15 minutes)
```

### Example 3: Partial Failure
```
🔄 Execution #12 - 2025-12-03T22:15:00
  Processing 8 symbols (3 of 8 might fail)...
  ✅ BTC: Signal=BUY, Confidence=85%
  ✅ ETH: Signal=HOLD, Confidence=60%
  ✅ SOL: Signal=BUY, Confidence=90% (recovered!)
  ⚠️ ADA: Timeout
  ✅ DOT: Signal=SELL, Confidence=70%
  ✅ XRP: Signal=HOLD, Confidence=55%
  ⚠️ LTC: Timeout
  ✅ BNB: Signal=SELL, Confidence=65%
  ⚠️ AVA: Failed
  ✅ FTT: Signal=HOLD, Confidence=60%
📊 Stats: success=7, failed=1, timeout=2
⚠️ Execution completed with 3 minor error(s) in 52s (continue anyway)
[Execution Status] ✅ SUCCESS - Execution #12
⏰ Next execution: 22:30:00 (in 15 minutes)
```

---

## What NOT to Worry About

✅ **Safe to Ignore** (program handles these):
- "Symbol [X]: timeout" → Will retry next cycle
- "Rate limit 429" → Program retries automatically
- "Failed to fetch Klines" → Single symbol fails, others continue
- "DeepSeek analysis failed" → Uses local analysis instead
- "Processing stats: failed=1" → This is normal, 7/8 is still good

❌ **Should NOT Ignore** (unexpected):
- Complete hang (nothing printed for 15+ minutes) → Likely stuck
- Scheduler stops running → Something crashed
- Every symbol fails → Likely API down or config error

---

## Performance Expectations

| Scenario | Expected Duration |
|----------|-------------------|
| **Normal** (8 symbols, good network) | 2-5 minutes |
| **Slow** (8 symbols, slow network) | 5-10 minutes |
| **Very Slow** (8 symbols, API delays) | 10-20 minutes |
| **Hit Timeout** (API very slow) | Exactly 300 seconds (5 min) |
| **Network Down** | ~300 seconds, return [] |

---

## Configuration Examples

### Make it Faster (risk: lower success rate)
```typescript
// In predictionScheduler.ts
const predictions = await this.executeWithTimeout(
    () => this.marketPredictor.predictMarket(),
    150000,  // Down from 300000 (2.5 min instead of 5 min)
    'Market Prediction'
);

// In marketPredictor.ts
const result = await Promise.race([
    this.processSymbol(symbolData),
    new Promise<null>((_, reject) =>
        setTimeout(() => reject(...), 30000)  // Down from 60000
    )
]);
```

### Make it More Reliable (slower)
```typescript
// In predictionScheduler.ts
const predictions = await this.executeWithTimeout(
    () => this.marketPredictor.predictMarket(),
    600000,  // Up from 300000 (10 min instead of 5 min)
    'Market Prediction'
);

// In marketPredictor.ts
const result = await Promise.race([
    this.processSymbol(symbolData),
    new Promise<null>((_, reject) =>
        setTimeout(() => reject(...), 120000)  // Up from 60000
    )
]);
```

---

## When to Adjust

### Increase Timeout When:
- You see "Execution timeout" errors frequently
- Network is consistently slow (>2s per API call)
- Want 100% completion even if slower

### Decrease Timeout When:
- Execution takes >10 minutes regularly
- Network is usually fast
- Want faster results even if some symbols fail

---

## Recovery Actions

### If Scheduler Crashes
```bash
# Stop current process
Ctrl+C

# Restart
npm run build
node dist/index.js

# Will resume 15-minute cycle from next interval
```

### If API is Down
```
Action: Do nothing
Behavior: Scheduler will:
  1. Try for 5 minutes (timeout)
  2. Log failure
  3. Wait 15 minutes
  4. Try again (retry)
  5. Repeat indefinitely
```

### If Stuck on One Symbol
```
Action: Do nothing
Behavior:
  1. Symbol hits 60s timeout
  2. Program skips this symbol
  3. Continues with next symbol
  4. Next cycle (15 min later) will retry stuck symbol
```

---

## Key Insight

> **One symbol's failure is just one symbol's failure.**
> 
> Not the end of the world. Likely just a network hiccup.
> The program will try again in 15 minutes.
> Meanwhile, it processes as many symbols as possible.

That's the whole philosophy! 🎯

