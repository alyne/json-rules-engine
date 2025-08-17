const { Engine, EngineFast } = require('../dist/index')
const { performance } = require('perf_hooks')
const rules = require('./rules')

async function benchmarkEngine (EngineClass, engineName, numEvents = 1000, numRules = 30) {
  console.log(`\n=== ${engineName} Benchmark ===`)

  // Create engine with rules
  const engine = new EngineClass()
  rules.slice(0, numRules).forEach(rule => engine.addRule(rule))

  // Generate test events
  const { generateEvents } = require('./events')
  const events = generateEvents(require('./events').baseEvents, numEvents)

  // Warm-up run with proper fact structure
  await engine.run(events[0])

  // Benchmark run
  const startTime = performance.now()
  let totalSuccessEvents = 0
  let totalFailureEvents = 0

  for (const event of events) {
    // Pass the event as facts to the engine
    const result = await engine.run(event)
    totalSuccessEvents += result.events.length
    totalFailureEvents += result.failureEvents.length
  }

  const endTime = performance.now()
  const duration = endTime - startTime
  const eventsPerSecond = Math.round(numEvents / (duration / 1000))

  console.log(`Events processed: ${numEvents}`)
  console.log(`Rules per event: ${numRules}`)
  console.log(`Total time: ${Math.round(duration)}ms`)
  console.log(`Events/second: ${eventsPerSecond}`)
  console.log(`Success events: ${totalSuccessEvents}`)
  console.log(`Failure events: ${totalFailureEvents}`)
  console.log(`Avg time per event: ${Math.round(duration / numEvents * 100) / 100}ms`)

  return {
    engineName,
    numEvents,
    numRules,
    duration,
    eventsPerSecond,
    totalSuccessEvents,
    totalFailureEvents,
    avgTimePerEvent: duration / numEvents
  }
}

async function runComparison () {
  console.log('Performance Comparison: Original vs Optimized Async Engine')
  console.log('==========================================================')

  const results = []

  // Test small workload
  console.log('\n--- Small Workload Test (100 events, 10 rules) ---')
  results.push(await benchmarkEngine(Engine, 'Original Engine', 100, 10))
  results.push(await benchmarkEngine(EngineFast, 'Optimized Engine (EngineFast)', 100, 10))

  // Test medium workload
  console.log('\n--- Medium Workload Test (500 events, 20 rules) ---')
  results.push(await benchmarkEngine(Engine, 'Original Engine', 500, 20))
  results.push(await benchmarkEngine(EngineFast, 'Optimized Engine (EngineFast)', 500, 20))

  // Test large workload
  console.log('\n--- Large Workload Test (1000 events, 30 rules) ---')
  results.push(await benchmarkEngine(Engine, 'Original Engine', 1000, 30))
  results.push(await benchmarkEngine(EngineFast, 'Optimized Engine (EngineFast)', 1000, 30))

  // Performance comparison summary
  console.log('\n\n=== PERFORMANCE COMPARISON SUMMARY ===')

  for (let i = 0; i < results.length; i += 2) {
    const original = results[i]
    const optimized = results[i + 1]
    const improvement = ((original.duration - optimized.duration) / original.duration) * 100
    const throughputImprovement = ((optimized.eventsPerSecond - original.eventsPerSecond) / original.eventsPerSecond) * 100

    console.log(`\n${original.numEvents} events, ${original.numRules} rules:`)
    console.log(`  Original:  ${Math.round(original.duration)}ms (${original.eventsPerSecond} events/sec)`)
    console.log(`  Optimized: ${Math.round(optimized.duration)}ms (${optimized.eventsPerSecond} events/sec)`)
    console.log(`  Performance: ${improvement > 0 ? '+' : ''}${Math.round(improvement * 100) / 100}% ${improvement > 0 ? 'faster' : 'slower'}`)
    console.log(`  Throughput: ${throughputImprovement > 0 ? '+' : ''}${Math.round(throughputImprovement * 100) / 100}% ${throughputImprovement > 0 ? 'better' : 'worse'}`)
  }

  // Overall assessment
  const totalOriginalTime = results.filter((_, i) => i % 2 === 0).reduce((sum, r) => sum + r.duration, 0)
  const totalOptimizedTime = results.filter((_, i) => i % 2 === 1).reduce((sum, r) => sum + r.duration, 0)
  const overallImprovement = ((totalOriginalTime - totalOptimizedTime) / totalOriginalTime) * 100

  console.log('\n=== OVERALL PERFORMANCE ===')
  console.log(`Total Original Time: ${Math.round(totalOriginalTime)}ms`)
  console.log(`Total Optimized Time: ${Math.round(totalOptimizedTime)}ms`)
  console.log(`Overall Improvement: ${overallImprovement > 0 ? '+' : ''}${Math.round(overallImprovement * 100) / 100}% ${overallImprovement > 0 ? 'faster' : 'slower'}`)
}

if (require.main === module) {
  runComparison().catch(console.error)
}

module.exports = { benchmarkEngine, runComparison }
