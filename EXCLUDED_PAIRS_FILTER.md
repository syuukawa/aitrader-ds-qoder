# Excluded Pairs Filter Implementation

## Overview

The `excluded_pairs.txt` filter has been integrated into the `MarketPredictor` class to automatically exclude unwanted trading pairs from the prediction workflow.

## Implementation Details

### File Location
The `excluded_pairs.txt` file should be located in:
```
/Users/zhouhe/blockchain/2-github/qoder-aitrader/aitrader-ds-qoder/src/excluded_pairs.txt
```

### File Format
Each trading pair should be on a separate line, e.g.:
```
ALPHAUSDT
OCEANUSDT
AGIXUSDT
UXLINKUSDT
PORT3USDT
LSKUSDT
BSWUSDT
```

### How It Works

#### 1. Loading Excluded Pairs
When `MarketPredictor` is instantiated, it calls `loadExcludedPairs()` which:
- Attempts to find the file at multiple possible locations:
  - `dist/prediction/../excluded_pairs.txt` (compiled version)
  - `../../src/excluded_pairs.txt` (relative to compiled location)
  - `src/excluded_pairs.txt` (relative to working directory)
  - `excluded_pairs.txt` (working directory root)
- Reads and parses the file into a `Set<string>` for O(1) lookup
- Logs the number of loaded pairs and file location
- Gracefully handles missing file with informative message

#### 2. Filtering Process
During `getFilteredSymbols()`:
1. Fetches all 24-hour ticker data from Binance
2. For each ticker, checks:
   - **Is USDT pair?** → Filter out non-USDT pairs
   - **Is excluded?** → Skip if in exclusion list (with console message)
   - **Meets volume threshold?** → Filter by trading volume
   - **Meets price change threshold?** → Filter by 24h change %

#### 3. Console Output
The filter provides clear feedback:
```
📋 已加载 7 个排除的交易对 (来自: /path/to/excluded_pairs.txt)
📊 正在获取所有交易对的24小时数据...
📈 共获得 2000+ 个交易对的数据
⏭️  跳过已排除的交易对: ALPHAUSDT
⏭️  跳过已排除的交易对: OCEANUSDT
...
🎯 筛选后得到 45 个符合条件的交易对
```

If file not found:
```
ℹ️  excluded_pairs.txt 文件不存在，将处理所有符合条件的交易对
   已尝试的路径: dist/prediction/../excluded_pairs.txt, ../../src/excluded_pairs.txt, src/excluded_pairs.txt, excluded_pairs.txt
```

## Code Structure

### Class Properties
```typescript
private excludedPairs: Set<string> = new Set(); // 排除的交易对集合
```

### Initialization
```typescript
constructor(...) {
    // ... other initialization ...
    this.loadExcludedPairs(); // Load on construction
}
```

### Loading Method
```typescript
private loadExcludedPairs(): void {
    // 尝试多个可能的路径位置
    const possiblePaths = [
        path.join(__dirname, '../excluded_pairs.txt'),
        path.join(__dirname, '../../src/excluded_pairs.txt'),
        path.join(process.cwd(), 'src/excluded_pairs.txt'),
        path.join(process.cwd(), 'excluded_pairs.txt')
    ];
    // ... file reading logic ...
}
```

### Filtering Logic
```typescript
const filteredSymbols = allTickers.filter(ticker => {
    // 排除在黑名单中的交易对
    if (this.excludedPairs.has(ticker.symbol)) {
        console.log(`⏭️  跳过已排除的交易对: ${ticker.symbol}`);
        return false;
    }
    // ... other filters ...
});
```

## Performance Considerations

- **Lookup Complexity**: O(1) using Set data structure
- **File I/O**: Only happens once during initialization
- **Memory**: Minimal footprint (~1KB for 7 pairs)
- **Scalability**: Easily handles hundreds of excluded pairs

## Error Handling

The implementation gracefully handles:
1. **Missing file**: Logs info and continues processing all symbols
2. **Read errors**: Logs warning and continues with empty exclusion list
3. **Malformed entries**: Filters out empty lines automatically
4. **Case sensitivity**: Uses exact matching (ALPHAUSDT ≠ alphausdt)

## Usage in Workflow

### Complete Filtering Flow
```
1. MarketPredictor.constructor()
   └─ loadExcludedPairs() → Load and cache excluded pairs

2. predictMarket()
   └─ getFilteredSymbols()
      ├─ Fetch 2000+ tickers from Binance
      └─ Apply filters in order:
         1. USDT pairs only
         2. NOT in excluded list
         3. Volume > 50M USDT
         4. Price change > 5%

3. Result: Filtered list of valid trading pairs for analysis
```

## Modifying the Exclusion List

### Adding Pairs
Simply add to `excluded_pairs.txt`:
```
ALPHAUSDT
OCEANUSDT
NEWPAIR1USDT  ← Add new pair
NEWPAIR2USDT
```

### Removing Pairs
Delete the line from the file and the application will pick up changes on next restart.

### Dynamic Reloading
To reload without restarting, would require:
```typescript
// Add method to class (not currently implemented)
public reloadExcludedPairs(): void {
    this.loadExcludedPairs();
}
```

## Integration with Other Features

The exclusion filter works seamlessly with:
- **DeepSeek AI Analysis**: Excluded pairs never reach AI analysis
- **CSV Export**: Only processes non-excluded, BUY-signal pairs
- **Market Reports**: SimplifiedReporter only gets non-excluded data
- **Scheduler**: Filter runs on each 15-minute execution

## Troubleshooting

### Issue: Pairs still being processed despite exclusion list

**Cause**: File not found in expected location

**Solution**: Check console output for attempted paths and place file in correct location

### Issue: "File not found" message appears

**Cause**: excluded_pairs.txt missing from expected locations

**Solution**: 
1. Ensure file exists at: `src/excluded_pairs.txt`
2. Or place at project root with filename: `excluded_pairs.txt`
3. Restart application after adding file

### Issue: Excluded pairs still appearing in output

**Cause**: Incorrect pair names or case mismatch

**Solution**: Verify exact pair names match Binance symbols (case-sensitive)
- Correct: `ALPHAUSDT`
- Incorrect: `alphausdt` or `Alpha USDT`

## Future Enhancements

Potential improvements:
1. **Hot reload**: Refresh exclusion list without restart
2. **Regex patterns**: Support wildcard patterns (e.g., `SCAM*USDT`)
3. **Categories**: Different exclusion lists for different purposes
4. **Comments**: Allow `#` comments in the file
5. **Logging**: Save filtered pair count to daily log
6. **API-based**: Load from external API or database instead of file

## Summary

The excluded pairs filter provides:
- ✅ Simple text file-based configuration
- ✅ O(1) lookup performance
- ✅ Graceful fallback if file missing
- ✅ Clear console feedback
- ✅ Seamless integration with existing workflow
- ✅ Easy to maintain and update
