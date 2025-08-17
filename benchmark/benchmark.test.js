'use strict'

const { expect } = require('chai')
const StreamBenchmark = require('./benchmark')

describe('Stream Benchmark', function () {
  this.timeout(30000)

  it('should run a small benchmark successfully', async function () {
    const benchmark = new StreamBenchmark({
      eventCount: 10,
      ruleCount: 5,
      warmupRuns: 1,
      benchmarkRuns: 2
    })

    const results = await benchmark.runBenchmark()

    expect(results).to.have.lengthOf(2)
    expect(results[0]).to.have.property('throughput')
    expect(results[0]).to.have.property('duration')
    expect(results[0]).to.have.property('memory')
    expect(results[0].throughput.eventsPerSecond).to.be.greaterThan(0)
  })

  it('should handle empty event streams', async function () {
    const benchmark = new StreamBenchmark({
      eventCount: 0,
      ruleCount: 3,
      warmupRuns: 1,
      benchmarkRuns: 1
    })

    const results = await benchmark.runBenchmark()

    expect(results).to.have.lengthOf(1)
    expect(results[0].totals.events).to.equal(0)
  })
})
