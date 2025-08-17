'use strict'

const { Engine } = require('../dist/index')
const { EngineSync } = require('../dist/sync/index-sync')
const { pipeline } = require('stream')
const { promisify } = require('util')
const rules = require('./rules')
const { baseEvents, generateEvents } = require('./events')
const { ArrayReadStream, ArrayWriteStream, RuleEngineTransform } = require('./stream-utils')
const { RuleEngineTransformSync } = require('./stream-utils-sync')
const PerformanceMonitor = require('./performance-monitor')

const pipelineAsync = promisify(pipeline)

class BenchmarkComparison {
  constructor (options = {}) {
    this.eventCount = options.eventCount || 1000
    this.ruleCount = options.ruleCount || 30
    this.warmupRuns = options.warmupRuns || 3
    this.benchmarkRuns = options.benchmarkRuns || 5
  }

  setupAsyncEngine () {
    const engine = new Engine()
    const rulesToUse = rules.slice(0, this.ruleCount)
    rulesToUse.forEach(rule => {
      engine.addRule({
        conditions: rule.conditions,
        event: rule.event,
        priority: Math.floor(Math.random() * 5) + 1
      })
    })
    return engine
  }

  setupSyncEngine () {
    const engine = new EngineSync()
    const rulesToUse = rules.slice(0, this.ruleCount)
    rulesToUse.forEach(rule => {
      engine.addRule({
        conditions: rule.conditions,
        event: rule.event,
        priority: Math.floor(Math.random() * 5) + 1
      })
    })
    return engine
  }

  async runAsyncBenchmark () {
    const engine = this.setupAsyncEngine()
    const events = generateEvents(baseEvents, this.eventCount)
    const monitor = new PerformanceMonitor()

    const readStream = new ArrayReadStream(events.map(event => ({ Body: event })))
    const transform = new RuleEngineTransform(engine)
    const writeStream = new ArrayWriteStream()

    monitor.start()
    await pipelineAsync(readStream, transform, writeStream)
    monitor.end()

    const transformStats = transform.getStats()
    const results = monitor.getResults()
    const outputs = writeStream.getResults()
    const totalTriggered = outputs.reduce((sum, output) => sum + (output.triggeredCount || 0), 0)

    results.streamStats = transformStats
    results.outputCount = outputs.length
    results.totalTriggered = totalTriggered
    results.throughput.eventsPerSecond = transformStats.throughputPerSecond
    results.totals.eventsTriggered = totalTriggered
    results.variant = 'async'

    return results
  }

  async runSyncBenchmark () {
    const engine = this.setupSyncEngine()
    const events = generateEvents(baseEvents, this.eventCount)
    const monitor = new PerformanceMonitor()

    const readStream = new ArrayReadStream(events.map(event => ({ Body: event })))
    const transform = new RuleEngineTransformSync(engine)
    const writeStream = new ArrayWriteStream()

    monitor.start()
    await pipelineAsync(readStream, transform, writeStream)
    monitor.end()

    const transformStats = transform.getStats()
    const results = monitor.getResults()
    const outputs = writeStream.getResults()
    const totalTriggered = outputs.reduce((sum, output) => sum + (output.triggeredCount || 0), 0)

    results.streamStats = transformStats
    results.outputCount = outputs.length
    results.totalTriggered = totalTriggered
    results.throughput.eventsPerSecond = transformStats.throughputPerSecond
    results.totals.eventsTriggered = totalTriggered
    results.variant = 'sync'

    return results
  }

  async warmup () {
    console.log(`Running ${this.warmupRuns} warmup iterations for both variants...`)
    for (let i = 0; i < this.warmupRuns; i++) {
      await this.runAsyncBenchmark()
      await this.runSyncBenchmark()
      process.stdout.write('.')
    }
    console.log(' warmup complete\n')
  }

  async runComparison () {
    console.log('⚡ Starting Async vs Sync Performance Comparison\n')
    console.log(`Configuration:
  • Rules: ${this.ruleCount}
  • Events per run: ${this.eventCount}
  • Benchmark runs: ${this.benchmarkRuns}
  • Warmup runs: ${this.warmupRuns}
`)

    await this.warmup()

    console.log('Running async vs sync benchmarks...')
    const asyncResults = []
    const syncResults = []

    for (let i = 0; i < this.benchmarkRuns; i++) {
      process.stdout.write(`Run ${i + 1}/${this.benchmarkRuns}: `)

      const asyncResult = await this.runAsyncBenchmark()
      const syncResult = await this.runSyncBenchmark()

      asyncResults.push(asyncResult)
      syncResults.push(syncResult)

      const improvement = ((syncResult.throughput.eventsPerSecond / asyncResult.throughput.eventsPerSecond - 1) * 100).toFixed(1)
      console.log(`Async: ${asyncResult.throughput.eventsPerSecond.toFixed(0)} events/sec | Sync: ${syncResult.throughput.eventsPerSecond.toFixed(0)} events/sec | Improvement: ${improvement}%`)
    }

    this.printComparison(asyncResults, syncResults)
    return { asyncResults, syncResults }
  }

  printComparison (asyncResults, syncResults) {
    const asyncThroughputs = asyncResults.map(r => r.throughput.eventsPerSecond)
    const syncThroughputs = syncResults.map(r => r.throughput.eventsPerSecond)
    const asyncDurations = asyncResults.map(r => r.duration.milliseconds)
    const syncDurations = syncResults.map(r => r.duration.milliseconds)
    const asyncMemory = asyncResults.map(r => r.memory.peakHeapMB)
    const syncMemory = syncResults.map(r => r.memory.peakHeapMB)

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
    const improvement = (sync, async) => ((sync / async - 1) * 100).toFixed(1)

    console.log(`\n📊 Async vs Sync Comparison (${this.benchmarkRuns} runs)`)
    console.log('===========================================')
    console.log(`
Throughput (events/sec):
                     Async        Sync      Improvement
  • Average:      ${avg(asyncThroughputs).toFixed(0).padStart(8)}    ${avg(syncThroughputs).toFixed(0).padStart(8)}         ${improvement(avg(syncThroughputs), avg(asyncThroughputs))}%
  • Max:          ${Math.max(...asyncThroughputs).toFixed(0).padStart(8)}    ${Math.max(...syncThroughputs).toFixed(0).padStart(8)}         ${improvement(Math.max(...syncThroughputs), Math.max(...asyncThroughputs))}%

Duration (ms):
                     Async        Sync      Improvement  
  • Average:      ${avg(asyncDurations).toFixed(1).padStart(8)}    ${avg(syncDurations).toFixed(1).padStart(8)}         ${improvement(avg(asyncDurations), avg(syncDurations))}%
  • Min:          ${Math.min(...asyncDurations).toFixed(1).padStart(8)}    ${Math.min(...syncDurations).toFixed(1).padStart(8)}         ${improvement(Math.min(asyncDurations), Math.min(...syncDurations))}%

Memory (Peak Heap MB):
                     Async        Sync      Difference
  • Average:      ${avg(asyncMemory).toFixed(1).padStart(8)}    ${avg(syncMemory).toFixed(1).padStart(8)}         ${(avg(asyncMemory) - avg(syncMemory)).toFixed(1)}MB

Performance Summary:
  • Sync is ${improvement(avg(syncThroughputs), avg(asyncThroughputs))}% faster on average
  • Sync uses ${(avg(asyncMemory) - avg(syncMemory)).toFixed(1)}MB less memory on average
  • Processing ${this.eventCount.toLocaleString()} events with ${this.ruleCount} rules
`)
  }
}

async function main () {
  const args = process.argv.slice(2)
  const options = {}

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace('--', '')
    const value = args[i + 1]

    if (key && value) {
      if (key === 'events') options.eventCount = parseInt(value, 10)
      if (key === 'rules') options.ruleCount = parseInt(value, 10)
      if (key === 'runs') options.benchmarkRuns = parseInt(value, 10)
      if (key === 'warmup') options.warmupRuns = parseInt(value, 10)
    }
  }

  const benchmark = new BenchmarkComparison(options)

  try {
    await benchmark.runComparison()
  } catch (error) {
    console.error('❌ Comparison failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = BenchmarkComparison
