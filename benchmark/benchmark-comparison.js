"use strict";

const { Engine, EngineFast } = require("../dist/index");
const { pipeline } = require("stream");
const { promisify } = require("util");
const rules = require("./rules");
const { baseEvents, generateEvents } = require("./events");
const {
  ArrayReadStream,
  ArrayWriteStream,
  RuleEngineTransform,
} = require("./stream-utils");
const PerformanceMonitor = require("./performance-monitor");

const pipelineAsync = promisify(pipeline);

class BenchmarkComparison {
  constructor(options = {}) {
    this.eventCount = options.eventCount || 10000;
    this.ruleCount = options.ruleCount || 30;
    this.warmupRuns = options.warmupRuns || 3;
    this.benchmarkRuns = options.benchmarkRuns || 5;
  }

  setupEngine(EngineClass) {
    const engine = new EngineClass();
    const rulesToUse = rules.slice(0, this.ruleCount);
    rulesToUse.forEach((rule) => {
      engine.addRule({
        conditions: rule.conditions,
        event: rule.event,
        priority: Math.floor(Math.random() * 5) + 1,
      });
    });
    return engine;
  }

  setupAsyncEngine() {
    return this.setupEngine(Engine);
  }

  setupFastEngine() {
    return this.setupEngine(EngineFast);
  }

  async runBenchmarkFor(engine, variant) {
    const events = generateEvents(baseEvents, this.eventCount);
    const monitor = new PerformanceMonitor();

    const readStream = new ArrayReadStream(
      events.map((event) => ({ Body: event })),
    );
    const transform = new RuleEngineTransform(engine);
    const writeStream = new ArrayWriteStream();

    monitor.start();
    await pipelineAsync(readStream, transform, writeStream);
    monitor.end();

    const transformStats = transform.getStats();
    const results = monitor.getResults();
    const outputs = writeStream.getResults();
    const totalTriggered = outputs.reduce(
      (sum, output) => sum + (output.triggeredCount || 0),
      0,
    );

    results.streamStats = transformStats;
    results.outputCount = outputs.length;
    results.totalTriggered = totalTriggered;
    results.throughput.eventsPerSecond = transformStats.throughputPerSecond;
    results.totals.eventsTriggered = totalTriggered;
    results.variant = variant;

    return results;
  }

  async runAsyncBenchmark() {
    return this.runBenchmarkFor(this.setupAsyncEngine(), "async");
  }

  async runFastBenchmark() {
    return this.runBenchmarkFor(this.setupFastEngine(), "fast");
  }

  async warmup() {
    console.log(
      `Running ${this.warmupRuns} warmup iterations for both variants...`,
    );
    for (let i = 0; i < this.warmupRuns; i++) {
      await this.runAsyncBenchmark();
      await this.runFastBenchmark();
      process.stdout.write(".");
    }
    console.log(" warmup complete\n");
  }

  async runComparison() {
    console.log("⚡ Starting Async vs Fast Performance Comparison\n");
    console.log(`Configuration:
  • Rules: ${this.ruleCount}
  • Events per run: ${this.eventCount}
  • Benchmark runs: ${this.benchmarkRuns}
  • Warmup runs: ${this.warmupRuns}
`);

    await this.warmup();

    console.log("Running benchmarks...");
    const asyncResults = [];
    const fastResults = [];

    for (let i = 0; i < this.benchmarkRuns; i++) {
      process.stdout.write(`Run ${i + 1}/${this.benchmarkRuns}: `);

      const asyncResult = await this.runAsyncBenchmark();
      const fastResult = await this.runFastBenchmark();

      asyncResults.push(asyncResult);
      fastResults.push(fastResult);

      const improvement = (
        (fastResult.throughput.eventsPerSecond /
          asyncResult.throughput.eventsPerSecond -
          1) *
        100
      ).toFixed(1);
      console.log(
        `Async: ${asyncResult.throughput.eventsPerSecond.toFixed(0)} events/sec | Fast: ${fastResult.throughput.eventsPerSecond.toFixed(0)} events/sec | Improvement: ${improvement}%`,
      );
    }

    this.printComparison(asyncResults, fastResults);
    return { asyncResults, fastResults };
  }

  printComparison(asyncResults, fastResults) {
    const tps = (results) => results.map((r) => r.throughput.eventsPerSecond);
    const dur = (results) => results.map((r) => r.duration.milliseconds);
    const mem = (results) => results.map((r) => r.memory.peakHeapMB);

    const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const pct = (a, base) => ((a / base - 1) * 100).toFixed(1);

    const asyncTp = tps(asyncResults);
    const fastTp = tps(fastResults);
    const asyncDur = dur(asyncResults);
    const fastDur = dur(fastResults);
    const asyncMem = mem(asyncResults);
    const fastMem = mem(fastResults);

    const avgAsyncTp = avg(asyncTp);
    const avgFastTp = avg(fastTp);

    console.log(`\n📊 Async vs Fast Comparison (${this.benchmarkRuns} runs)`);
    console.log("===========================================");
    console.log(`
Throughput (events/sec):
                     Async        Fast      Improvement
  • Average:      ${avgAsyncTp.toFixed(0).padStart(8)}    ${avgFastTp.toFixed(0).padStart(8)}         ${pct(avgFastTp, avgAsyncTp)}%
  • Max:          ${Math.max(...asyncTp).toFixed(0).padStart(8)}    ${Math.max(...fastTp).toFixed(0).padStart(8)}         ${pct(Math.max(...fastTp), Math.max(...asyncTp))}%

Duration (ms, average):
  • Async:        ${avg(asyncDur).toFixed(1)}
  • Fast:         ${avg(fastDur).toFixed(1)}

Memory (Peak Heap MB, average):
  • Async:        ${avg(asyncMem).toFixed(1)}
  • Fast:         ${avg(fastMem).toFixed(1)}

Performance Summary:
  • Fast is ${pct(avgFastTp, avgAsyncTp)}% faster on average
  • Processing ${this.eventCount.toLocaleString()} events with ${this.ruleCount} rules
`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace("--", "");
    const value = args[i + 1];

    if (key && value) {
      if (key === "events") options.eventCount = parseInt(value, 10);
      if (key === "rules") options.ruleCount = parseInt(value, 10);
      if (key === "runs") options.benchmarkRuns = parseInt(value, 10);
      if (key === "warmup") options.warmupRuns = parseInt(value, 10);
    }
  }

  const benchmark = new BenchmarkComparison(options);

  try {
    await benchmark.runComparison();
  } catch (error) {
    console.error("❌ Comparison failed:", error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BenchmarkComparison;
