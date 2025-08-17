const { Engine, EngineFast, EngineUltra } = require('../dist/index')
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
  console.log('Performance Comparison: Debug Overhead Elimination')
  console.log('='.repeat(60))

  const smallWorkload = { events: 100, rules: 10 }
  const mediumWorkload = { events: 500, rules: 20 }
  const largeWorkload = { events: 1000, rules: 30 }

  for (const { events, rules } of [smallWorkload, mediumWorkload, largeWorkload]) {
    console.log(`\n🔍 Workload: ${events} events, ${rules} rules`)

    const [originalResult, fastResult, ultraResult] = await Promise.all([
      benchmarkEngine(Engine, 'Engine (Original)', events, rules),
      benchmarkEngine(EngineFast, 'EngineFast', events, rules),
      benchmarkEngine(EngineUltra, 'EngineUltra', events, rules)
    ])

    const fastImprovement = ((fastResult.eventsPerSecond - originalResult.eventsPerSecond) / originalResult.eventsPerSecond * 100).toFixed(2)
    const ultraImprovement = ((ultraResult.eventsPerSecond - originalResult.eventsPerSecond) / originalResult.eventsPerSecond * 100).toFixed(2)
    const ultraVsFast = ((ultraResult.eventsPerSecond - fastResult.eventsPerSecond) / fastResult.eventsPerSecond * 100).toFixed(2)

    console.log('\n📊 Performance Improvements:')
    console.log(`EngineFast vs Original: +${fastImprovement}%`)
    console.log(`EngineUltra vs Original: +${ultraImprovement}%`)
    console.log(`EngineUltra vs EngineFast: +${ultraVsFast}%`)
  }
}

if (require.main === module) {
  runComparison().catch(console.error)
}

module.exports = { benchmarkEngine, runComparison }
