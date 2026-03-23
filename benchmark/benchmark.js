'use strict'

const { Engine } = require('../dist/index')
const { pipeline } = require('stream')
const { promisify } = require('util')
const rules = require('./rules')
const { baseEvents, generateEvents } = require('./events')
const { ArrayReadStream, ArrayWriteStream, RuleEngineTransform } = require('./stream-utils')
const PerformanceMonitor = require('./performance-monitor')

const pipelineAsync = promisify(pipeline)

class StreamBenchmark {
  constructor (options = {}) {
    this.eventCount = options.eventCount || 1000
    this.ruleCount = options.ruleCount || 30
    this.warmupRuns = options.warmupRuns || 3
    this.benchmarkRuns = options.benchmarkRuns || 5
  }

  setupEngine () {
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

  async runSingleBenchmark () {
    const engine = this.setupEngine()
    const events = generateEvents(baseEvents, this.eventCount)
    const monitor = new PerformanceMonitor()

    const readStream = new ArrayReadStream(events.map(event => ({ Body: event })))
    const transform = new RuleEngineTransform(engine)
    const writeStream = new ArrayWriteStream()

    monitor.start()

    await pipelineAsync(
      readStream,
      transform,
      writeStream
    )

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

    return results
  }

  async warmup () {
    console.log(`Running ${this.warmupRuns} warmup iterations...`)
    for (let i = 0; i < this.warmupRuns; i++) {
      await this.runSingleBenchmark()
      process.stdout.write('.')
    }
    console.log(' warmup complete\n')
  }

  async runBenchmark () {
    console.log('🚀 Starting json-rules-engine Stream Benchmark\n')
    console.log(`Configuration:
  • Rules: ${this.ruleCount}
  • Events per run: ${this.eventCount}
  • Benchmark runs: ${this.benchmarkRuns}
  • Warmup runs: ${this.warmupRuns}
`)

    await this.warmup()

    console.log(`Running ${this.benchmarkRuns} benchmark iterations...`)
    const benchmarkResults = []

    for (let i = 0; i < this.benchmarkRuns; i++) {
      process.stdout.write(`Run ${i + 1}/${this.benchmarkRuns}: `)
      const result = await this.runSingleBenchmark()
      benchmarkResults.push(result)
      console.log(`${result.throughput.eventsPerSecond.toFixed(0)} events/sec`)
    }

    this.printSummary(benchmarkResults)
    return benchmarkResults
  }

  printSummary (results) {
    const throughputs = results.map(r => r.throughput.eventsPerSecond)
    const durations = results.map(r => r.duration.milliseconds)
    const memoryDeltas = results.map(r => r.memory.deltaMB)
    const peakMemories = results.map(r => r.memory.peakHeapMB)

    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length
    const min = arr => Math.min(...arr)
    const max = arr => Math.max(...arr)
    const median = arr => {
      const sorted = [...arr].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
    }

    console.log(`\n📊 Benchmark Summary (${this.benchmarkRuns} runs)`)
    console.log('=====================================')
    console.log(`
Throughput (events/sec):
  • Average: ${avg(throughputs).toFixed(2)}
  • Median:  ${median(throughputs).toFixed(2)}
  • Min:     ${min(throughputs).toFixed(2)}
  • Max:     ${max(throughputs).toFixed(2)}

Duration (ms):
  • Average: ${avg(durations).toFixed(2)}
  • Median:  ${median(durations).toFixed(2)}
  • Min:     ${min(durations).toFixed(2)}
  • Max:     ${max(durations).toFixed(2)}

Memory Usage:
  • Peak Heap (avg): ${avg(peakMemories).toFixed(2)} MB
  • Memory Delta (avg): ${avg(memoryDeltas).toFixed(2)} MB
  • Memory Delta (max): ${max(memoryDeltas).toFixed(2)} MB

Configuration:
  • Events per run: ${this.eventCount.toLocaleString()}
  • Rules: ${this.ruleCount}
  • Total events processed: ${(this.eventCount * this.benchmarkRuns).toLocaleString()}
  • Total rule evaluations: ${(this.eventCount * this.ruleCount * this.benchmarkRuns).toLocaleString()}
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

  const benchmark = new StreamBenchmark(options)

  try {
    await benchmark.runBenchmark()
  } catch (error) {
    console.error('❌ Benchmark failed:', error.message)
    process.exit(1)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

module.exports = StreamBenchmark
