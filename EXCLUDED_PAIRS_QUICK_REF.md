# Quick Reference: Excluded Pairs Filter

## What Changed?

The `MarketPredictor` class now automatically loads and applies an exclusion filter from `excluded_pairs.txt` during symbol filtering.

## Key Features

| Feature | Details |
|---------|---------|
| **File Location** | `src/excluded_pairs.txt` |
| **File Format** | One pair per line (e.g., `ALPHAUSDT`) |
| **Lookup Speed** | O(1) using Set data structure |
| **Failure Handling** | Graceful fallback if file missing |
| **Logging** | Clear console messages for debugging |
| **Case Sensitive** | Yes - must match Binance symbol exactly |

## Usage

### Basic Setup
1. Create `excluded_pairs.txt` in the `src/` directory
2. Add pairs to exclude, one per line:
   ```
   ALPHAUSDT
   OCEANUSDT
   AGIXUSDT
   ```
3. Run the application - exclusion list loads automatically

### File Locations (Priority Order)
The application searches for the file in this order:
1. `src/excluded_pairs.txt` ← Recommended location
2. `dist/prediction/../excluded_pairs.txt`
3. `excluded_pairs.txt` (project root)
4. Working directory root

### Example Output

**With file found:**
```
📋 已加载 7 个排除的交易对 (来自: /path/to/src/excluded_pairs.txt)
📊 正在获取所有交易对的24小时数据...
📈 共获得 2000+ 个交易对的数据
⏭️  跳过已排除的交易对: ALPHAUSDT
⏭️  跳过已排除的交易对: OCEANUSDT
🎯 筛选后得到 45 个符合条件的交易对
```

**Without file:**
```
ℹ️  excluded_pairs.txt 文件不存在，将处理所有符合条件的交易对
   已尝试的路径: ...
```

## Implementation Details

### Added to MarketPredictor

**New Property:**
```typescript
private excludedPairs: Set<string> = new Set();
```

**New Method:**
```typescript
private loadExcludedPairs(): void { ... }
```

**Updated Constructor:**
```typescript
constructor(...) {
    this.loadExcludedPairs(); // ← New call
}
```

**Updated Filter:**
```typescript
if (this.excludedPairs.has(ticker.symbol)) {
    console.log(`⏭️  跳过已排除的交易对: ${ticker.symbol}`);
    return false;
}
```

## Common Tasks

### Add a Trading Pair to Exclusion List
```bash
echo "NEWPAIRUSDT" >> src/excluded_pairs.txt
```

### Check Current Excluded Pairs
```bash
cat src/excluded_pairs.txt
```

### Clear All Exclusions
```bash
rm src/excluded_pairs.txt
# Or create empty file:
touch src/excluded_pairs.txt
```

### View Excluded Pairs in Running App
Check console output for "已加载" message showing count and file path.

## Troubleshooting

| Problem | Solution |
|---------|----------|
| File not found message | Ensure `excluded_pairs.txt` is in `src/` directory |
| Pairs still being processed | Check pair names match Binance symbols exactly (case-sensitive) |
| Want to reload list | Restart the application |
| File in wrong location | Move to `src/excluded_pairs.txt` |
| Unexpected pair filtered | Verify pair name doesn't have extra whitespace |

## Performance Impact

- **Initialization**: ~1ms (file read + Set creation)
- **Per-Symbol Lookup**: O(1) constant time
- **Memory**: <1KB for typical exclusion list
- **Overall**: Negligible impact on performance

## Integration Points

The filter integrates at:
1. `MarketPredictor.constructor()` → Loads file
2. `getFilteredSymbols()` → Applies filter
3. All downstream processes → Receive filtered data

## Backward Compatibility

✅ **Fully backward compatible**
- If file doesn't exist, system processes all symbols
- No breaking changes to existing API
- No new dependencies required

## File Example

**Current `excluded_pairs.txt` (8 pairs):**
```
ALPHAUSDT
OCEANUSDT
AGIXUSDT
UXLINKUSDT
PORT3USDT
LSKUSDT
BSWUSDT
OCEANUSDT
```

Note: OCEANUSDT appears twice (duplicate), which is fine - Set will deduplicate automatically.

## Code Review Summary

**Changes Made:**
- Added `fs` and `path` imports
- Added `excludedPairs` Set property
- Added `loadExcludedPairs()` method with 4-path fallback
- Added constructor call to `loadExcludedPairs()`
- Updated `getFilteredSymbols()` filter logic
- Removed debug console logs

**Lines Changed:** ~50 lines (additions and modifications)
**Breaking Changes:** None
**Dependencies Added:** None (uses Node.js built-ins)

## Next Steps

1. Ensure `excluded_pairs.txt` exists in `src/` directory
2. Build project: `npm run build`
3. Run application and verify console output shows "已加载" message
4. Check that excluded pairs are properly skipped during filtering

---

**For more details**, see `EXCLUDED_PAIRS_FILTER.md` in the project root.
