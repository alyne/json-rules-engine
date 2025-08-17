# json-rules-engine Performance Benchmark

This benchmark tests the throughput and performance of json-rules-engine in a streaming scenario similar to production event processing pipelines.

## Overview

The benchmark simulates a real-world scenario where:
- Events flow through a **read stream** 
- A **transform stream** evaluates events against multiple rules using json-rules-engine
- Results are written to a **write stream**

This mirrors the architecture used in production hook systems for event validation and processing.

## Features

- **30 realistic rules** based on actual usage patterns
- **Configurable event counts** for scalability testing
- **Memory usage tracking** with garbage collection
- **Throughput measurements** (events/sec, rules/sec)
- **Statistical analysis** across multiple runs
- **Warmup iterations** for JIT optimization

## Usage

### Quick Test (100 events, 10 rules)
```bash
npm run benchmark:quick
```

### Standard Benchmark (1000 events, 30 rules)
```bash
npm run benchmark
```

### Full Scale Test (10,000 events, 30 rules)
```bash
npm run benchmark:full
```

### Custom Configuration
```bash
node --expose-gc benchmark/benchmark.js --events 5000 --rules 25 --runs 5 --warmup 2
```

## Parameters

- `--events N` - Number of events to process per run (default: 1000)
- `--rules N` - Number of rules to evaluate (default: 30, max: 30)
- `--runs N` - Number of benchmark iterations (default: 5)
- `--warmup N` - Number of warmup iterations (default: 3)

## Sample Output

```
🚀 Starting json-rules-engine Stream Benchmark

Configuration:
  • Rules: 30
  • Events per run: 1000
  • Benchmark runs: 5
  • Warmup runs: 3

Running 3 warmup iterations...
... warmup complete

Running 5 benchmark iterations...
Run 1/5: 2847 events/sec
Run 2/5: 3021 events/sec
Run 3/5: 2956 events/sec
Run 4/5: 3102 events/sec
Run 5/5: 2891 events/sec

📊 Benchmark Summary (5 runs)
=====================================

Throughput (events/sec):
  • Average: 2963.40
  • Median:  2956.00
  • Min:     2847.00
  • Max:     3102.00

Duration (ms):
  • Average: 337.54
  • Median:  338.20
  • Min:     322.45
  • Max:     351.22

Memory Usage:
  • Peak Heap (avg): 45.67 MB
  • Memory Delta (avg): 12.34 MB
  • Memory Delta (max): 15.89 MB

Configuration:
  • Events per run: 1,000
  • Rules: 30
  • Total events processed: 5,000
  • Total rule evaluations: 150,000
```

## Rule Types Tested

The benchmark includes 30 rules covering:
- **Event type matching** (ANY/ALL conditions)
- **JSONPath data extraction** (`$.record.status`, `$.record.review.maturityValue`)
- **Numeric comparisons** (greaterThan, lessThan, equal)
- **String matching** for status fields
- **Nested object property access**
- **Priority-based rule ordering**

## Event Types Simulated

- `com.alyne.users.loggedIn/loggedOut`
- `com.alyne.objects.created/updated`
- `com.alyne.questionnaireresponse.reviewed`
- `com.alyne.tasks.updated`
- `com.alyne.assessments.completed`
- `com.alyne.risks.created`
- And more...

## Performance Considerations

The benchmark helps identify:
- **Throughput limits** under different loads
- **Memory usage patterns** and potential leaks
- **Rule evaluation efficiency** 
- **Stream processing bottlenecks**
- **Garbage collection impact**

Use this benchmark to:
- Validate performance before production deployments
- Compare performance across json-rules-engine versions
- Optimize rule complexity and structure
- Size infrastructure for expected loads