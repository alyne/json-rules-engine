const { Engine, EngineUltra } = require('../dist/index')
const { performance } = require('perf_hooks')
const rules = require('./rules')

async function benchmarkEngine (EngineClass, engineName, numEvents = 1000, numRules = 30) {
  console.log(`\n=== ${engineName} Benchmark ===`)

  // Generate test events first
  const events = []
  for (let i = 0; i < numEvents; i++) {
    events.push({
      record: {
        review: {
          maturityValue: Math.floor(Math.random() * 5) + 1,
          isComplete: Math.random() > 0.3,
          score: Math.floor(Math.random() * 100),
          riskLevel: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)]
        },
        company: {
          size: ['small', 'medium', 'large'][Math.floor(Math.random() * 3)],
          industry: ['tech', 'finance', 'healthcare'][Math.floor(Math.random() * 3)]
        }
      },
      metadata: {
        timestamp: Date.now(),
        source: 'webhook'
      }
    })
  }

  // Create engine with rules
  const engine = new EngineClass()
  for (let i = 0; i < numRules; i++) {
    engine.addRule(rules[i])
  }

  // Add static facts that most rules will use
  engine.addFact('type', 'com.alyne.objects.updated')
  engine.addFact('eventType', 'com.alyne.objects.updated')
  engine.addFact('data', (params, almanac) => events[0]) // Use first event as data
  engine.addFact('companyId', 'company-123')
  engine.addFact('userId', 'user-456')

  console.log(`Engine setup: ${numRules} rules loaded`)

  // Warm up JIT
  for (let i = 0; i < 10; i++) {
    await engine.run(events[0])
  }

  // Actual benchmark
  const startTime = performance.now()

  for (let i = 0; i < numEvents; i++) {
    await engine.run(events[i])
  }

  const endTime = performance.now()
  const duration = endTime - startTime
  const eventsPerSecond = Math.round((numEvents * 1000) / duration)

  console.log(`Processed ${numEvents} events in ${duration.toFixed(2)}ms`)
  console.log(`Throughput: ${eventsPerSecond} events/second`)

  return { duration, eventsPerSecond, engineName }
}

async function runComparison () {
  console.log('Performance Comparison: EngineUltra vs Original Engine')
  console.log('='.repeat(60))

  const workloads = [
    { events: 100, rules: 10, name: 'Small' },
    { events: 500, rules: 20, name: 'Medium' },
    { events: 1000, rules: 30, name: 'Large' },
    { events: 2000, rules: 30, name: 'Extra Large' }
  ]

  for (const workload of workloads) {
    console.log(`\n🔍 ${workload.name} Workload: ${workload.events} events, ${workload.rules} rules`)

    const [originalResult, ultraResult] = await Promise.all([
      benchmarkEngine(Engine, 'Engine (Original)', workload.events, workload.rules),
      benchmarkEngine(EngineUltra, 'EngineUltra', workload.events, workload.rules)
    ])

    const improvement = ((ultraResult.eventsPerSecond - originalResult.eventsPerSecond) / originalResult.eventsPerSecond * 100).toFixed(2)
    const speedupFactor = (ultraResult.eventsPerSecond / originalResult.eventsPerSecond).toFixed(2)

    console.log('\n📊 Performance Results:')
    console.log(`Original: ${originalResult.eventsPerSecond} events/sec`)
    console.log(`Ultra:    ${ultraResult.eventsPerSecond} events/sec`)
    console.log(`Improvement: +${improvement}% (${speedupFactor}x faster)`)
  }
}

if (require.main === module) {
  runComparison().catch(console.error)
}

module.exports = { benchmarkEngine, runComparison }
