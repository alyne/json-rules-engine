'use strict'

class PerformanceMonitor {
  constructor () {
    this.metrics = {
      startTime: null,
      endTime: null,
      memoryBefore: null,
      memoryAfter: null,
      totalEvents: 0,
      totalRulesEvaluated: 0,
      totalEventsTriggered: 0,
      gcRuns: 0
    }
    this.intervalId = null
  }

  start () {
    this.metrics.startTime = process.hrtime.bigint()
    this.metrics.memoryBefore = process.memoryUsage()

    if (global.gc) {
      global.gc()
      this.metrics.gcRuns++
    }

    this.startMemoryMonitoring()
  }

  end () {
    this.metrics.endTime = process.hrtime.bigint()
    this.metrics.memoryAfter = process.memoryUsage()

    if (this.intervalId) {
      clearInterval(this.intervalId)
    }

    if (global.gc) {
      global.gc()
      this.metrics.gcRuns++
    }
  }

  startMemoryMonitoring () {
    this.intervalId = setInterval(() => {
      const current = process.memoryUsage()
      if (current.heapUsed > this.metrics.memoryAfter?.heapUsed || !this.metrics.memoryAfter) {
        this.metrics.memoryAfter = current
      }
    }, 100)
  }

  recordEventProcessed (rulesEvaluated = 1, eventsTriggered = 0) {
    this.metrics.totalEvents++
    this.metrics.totalRulesEvaluated += rulesEvaluated
    this.metrics.totalEventsTriggered += eventsTriggered
  }

  getResults () {
    const durationNs = this.metrics.endTime - this.metrics.startTime
    const durationMs = Number(durationNs) / 1000000
    const durationSeconds = durationMs / 1000

    const memoryDeltaMB = this.metrics.memoryAfter && this.metrics.memoryBefore
      ? (this.metrics.memoryAfter.heapUsed - this.metrics.memoryBefore.heapUsed) / 1024 / 1024
      : 0

    return {
      duration: {
        nanoseconds: Number(durationNs),
        milliseconds: durationMs,
        seconds: durationSeconds
      },
      throughput: {
        eventsPerSecond: this.metrics.totalEvents / durationSeconds,
        rulesPerSecond: this.metrics.totalRulesEvaluated / durationSeconds,
        triggeredEventsPerSecond: this.metrics.totalEventsTriggered / durationSeconds
      },
      memory: {
        before: this.metrics.memoryBefore,
        after: this.metrics.memoryAfter,
        deltaMB: memoryDeltaMB,
        peakHeapMB: this.metrics.memoryAfter ? this.metrics.memoryAfter.heapUsed / 1024 / 1024 : 0
      },
      totals: {
        events: this.metrics.totalEvents,
        rulesEvaluated: this.metrics.totalRulesEvaluated,
        eventsTriggered: this.metrics.totalEventsTriggered,
        gcRuns: this.metrics.gcRuns
      }
    }
  }

  formatResults (results, eventCount, ruleCount) {
    return `
Performance Benchmark Results
=============================
Configuration:
  • Rules: ${ruleCount}
  • Events: ${eventCount}
  • GC Runs: ${results.totals.gcRuns}

Duration:
  • Total: ${results.duration.milliseconds.toFixed(2)}ms (${results.duration.seconds.toFixed(3)}s)

Throughput:
  • Events/sec: ${results.throughput.eventsPerSecond.toFixed(2)}
  • Rules/sec: ${results.throughput.rulesPerSecond.toFixed(2)}
  • Triggered Events/sec: ${results.throughput.triggeredEventsPerSecond.toFixed(2)}

Memory Usage:
  • Peak Heap: ${results.memory.peakHeapMB.toFixed(2)} MB
  • Memory Delta: ${results.memory.deltaMB.toFixed(2)} MB
  • Before: ${(results.memory.before?.heapUsed / 1024 / 1024 || 0).toFixed(2)} MB
  • After: ${(results.memory.after?.heapUsed / 1024 / 1024 || 0).toFixed(2)} MB

Event Processing:
  • Total Events Processed: ${results.totals.events}
  • Total Rules Evaluated: ${results.totals.rulesEvaluated}
  • Total Events Triggered: ${results.totals.eventsTriggered}
  • Average Rules per Event: ${(results.totals.rulesEvaluated / results.totals.events).toFixed(2)}
`
  }
}

module.exports = PerformanceMonitor
