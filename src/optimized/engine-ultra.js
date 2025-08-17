'use strict'

import Fact from '../fact'
import RuleUltra from './rule-ultra'
import AlmanacUltra from './almanac-ultra'
import EventEmitter from 'eventemitter2'
import defaultOperators from '../engine-default-operators'
import defaultDecorators from '../engine-default-operator-decorators'
import { debug, debugEnabled } from './debug-fast'
import ConditionUltra from './condition-ultra'
import OperatorMap from '../operator-map'
import { hasProp, EVENT_PROP, CONDITIONS_PROP } from './perf-utils'

export const READY = 'READY'
export const RUNNING = 'RUNNING'
export const FINISHED = 'FINISHED'

class EngineUltra extends EventEmitter {
  /**
   * Returns a new ultra-optimized Engine instance with maximum performance
   * @param  {Rule[]} rules - array of rules to initialize with
   * @param  {Object} options - engine configuration options
   */
  constructor (rules = [], options = {}) {
    super()
    this.rules = []
    this.allowUndefinedFacts = options.allowUndefinedFacts || false
    this.allowUndefinedConditions = options.allowUndefinedConditions || false
    this.replaceFactsInEventParams = options.replaceFactsInEventParams || false
    this.pathResolver = options.pathResolver
    this.operators = new OperatorMap()
    this.facts = new Map()
    this.conditions = new Map()
    this.status = READY
    this.prioritizedRules = null

    // Initialize without function calls in hot path
    const rulesLength = rules.length
    for (let i = 0; i < rulesLength; i++) {
      this.addRule(rules[i])
    }

    // Batch operator/decorator setup
    const operatorsLength = defaultOperators.length
    for (let i = 0; i < operatorsLength; i++) {
      this.addOperator(defaultOperators[i])
    }

    const decoratorsLength = defaultDecorators.length
    for (let i = 0; i < decoratorsLength; i++) {
      this.addOperatorDecorator(defaultDecorators[i])
    }
  }

  addRule (properties) {
    if (!properties) throw new Error('Engine: addRule() requires options')

    let rule
    if (properties instanceof RuleUltra) {
      rule = properties
    } else {
      if (!hasProp(properties, EVENT_PROP)) throw new Error('Engine: addRule() argument requires "event" property')
      if (!hasProp(properties, CONDITIONS_PROP)) throw new Error('Engine: addRule() argument requires "conditions" property')
      rule = new RuleUltra(properties)
    }
    rule.setEngine(this)
    this.rules.push(rule)
    this.prioritizedRules = null
    return this
  }

  updateRule (rule) {
    const index = this.rules.findIndex(ruleInEngine => ruleInEngine.name === rule.name)
    if (index > -1) {
      this.rules.splice(index, 1)
      this.addRule(rule)
      this.prioritizedRules = null
    } else {
      throw new Error('Engine: updateRule() rule not found')
    }
  }

  removeRule (rule) {
    let ruleRemoved = false
    if (!(rule instanceof RuleUltra)) {
      const originalLength = this.rules.length
      this.rules = this.rules.filter(ruleInEngine => ruleInEngine.name !== rule)
      ruleRemoved = this.rules.length !== originalLength
    } else {
      const index = this.rules.indexOf(rule)
      if (index > -1) {
        ruleRemoved = Boolean(this.rules.splice(index, 1).length)
      }
    }
    if (ruleRemoved) {
      this.prioritizedRules = null
    }
    return ruleRemoved
  }

  setCondition (name, conditions) {
    if (!name) throw new Error('Engine: setCondition() requires name')
    if (!conditions) throw new Error('Engine: setCondition() requires conditions')
    if (!hasProp(conditions, 'all') && !hasProp(conditions, 'any') && !hasProp(conditions, 'not') && !hasProp(conditions, 'condition')) {
      throw new Error('"conditions" root must contain a single instance of "all", "any", "not", or "condition"')
    }
    this.conditions.set(name, new ConditionUltra(conditions))
    return this
  }

  removeCondition (name) {
    return this.conditions.delete(name)
  }

  addOperator (operatorOrName, cb) {
    this.operators.addOperator(operatorOrName, cb)
  }

  removeOperator (operatorOrName) {
    return this.operators.removeOperator(operatorOrName)
  }

  addOperatorDecorator (decoratorOrName, cb) {
    this.operators.addOperatorDecorator(decoratorOrName, cb)
  }

  removeOperatorDecorator (decoratorOrName) {
    return this.operators.removeOperatorDecorator(decoratorOrName)
  }

  addFact (id, valueOrMethod, options) {
    let factId = id
    let fact
    if (id instanceof Fact) {
      factId = id.id
      fact = id
    } else {
      fact = new Fact(factId, valueOrMethod, options)
    }
    if (debugEnabled) {
      debug('engine::addFact', { id: factId })
    }
    this.facts.set(factId, fact)
    return this
  }

  removeFact (factOrId) {
    let factId
    if (factOrId instanceof Fact) {
      factId = factOrId.id
    } else {
      factId = factOrId
    }
    return this.facts.delete(factId)
  }

  getFact (factId) {
    return this.facts.get(factId)
  }

  /**
   * Ultra-optimized rule prioritization with minimal object creation
   */
  prioritizeRules () {
    if (!this.prioritizedRules) {
      const ruleSets = {}
      const rulesLength = this.rules.length

      // Single pass through rules
      for (let i = 0; i < rulesLength; i++) {
        const rule = this.rules[i]
        const priority = rule.priority
        if (!ruleSets[priority]) ruleSets[priority] = []
        ruleSets[priority].push(rule)
      }

      // Sort priorities without intermediate array creation
      const priorities = Object.keys(ruleSets)
      priorities.sort((a, b) => Number(b) - Number(a)) // Descending order

      this.prioritizedRules = new Array(priorities.length)
      for (let i = 0; i < priorities.length; i++) {
        this.prioritizedRules[i] = ruleSets[priorities[i]]
      }
    }
    return this.prioritizedRules
  }

  stop () {
    this.status = FINISHED
    return this
  }

  /**
   * Ultra-optimized rule evaluation with minimal Promise overhead
   */
  evaluateRules (ruleArray, almanac) {
    const ruleArrayLength = ruleArray.length
    const promises = new Array(ruleArrayLength)

    for (let i = 0; i < ruleArrayLength; i++) {
      const rule = ruleArray[i]
      if (this.status !== RUNNING) {
        if (debugEnabled) {
          debug('engine::run, skipping remaining rules', { status: this.status })
        }
        promises[i] = Promise.resolve()
      } else {
        promises[i] = rule.evaluate(almanac).then((ruleResult) => {
          if (debugEnabled) {
            debug('engine::run', { ruleResult: ruleResult.result })
          }
          return ruleResult
        }).catch((error) => {
          if (debugEnabled) {
            debug('engine::evaluateRules error', { error: error.message })
          }
          throw error
        })
      }
    }

    return Promise.all(promises)
  }

  /**
   * Ultra-optimized main run method with minimal overhead
   */
  run (runtimeFacts = {}, runOptions = {}) {
    if (debugEnabled) {
      debug('engine::run started')
    }
    this.status = RUNNING

    const almanac = runOptions.almanac || new AlmanacUltra({
      facts: this.facts,
      pathResolver: this.pathResolver,
      allowUndefinedFacts: this.allowUndefinedFacts
    })

    // Fast runtime fact setup
    const runtimeFactKeys = Object.keys(runtimeFacts)
    const runtimeFactsLength = runtimeFactKeys.length
    for (let i = 0; i < runtimeFactsLength; i++) {
      const factId = runtimeFactKeys[i]
      const fact = new Fact(factId, runtimeFacts[factId])
      if (debugEnabled) {
        debug('engine::run initialized runtime fact', { id: fact.id, value: fact.value, type: typeof fact.value })
      }
      almanac.addRuntimeFact(fact.id, fact)
    }

    // Ultra-optimized rule execution
    const prioritizedRules = this.prioritizeRules()
    const executeRuleSets = (index) => {
      if (index >= prioritizedRules.length || this.status !== RUNNING) {
        if (debugEnabled) {
          debug('engine::run, stopping due to status change', { status: this.status })
        }
        return Promise.resolve([])
      }

      return this.evaluateRules(prioritizedRules[index], almanac).then(ruleResults => {
        return executeRuleSets(index + 1).then(nextResults => {
          return ruleResults.concat(nextResults)
        })
      })
    }

    return executeRuleSets(0).then(ruleResults => {
      this.status = FINISHED
      if (debugEnabled) {
        debug('engine::run completed')
      }

      // Fast result compilation
      const events = []
      const failureEvents = []
      const ruleResultsLength = ruleResults.length

      for (let i = 0; i < ruleResultsLength; i++) {
        const ruleResult = ruleResults[i]
        if (ruleResult && ruleResult.result) {
          events.push(ruleResult.event)
        } else if (ruleResult && !ruleResult.result) {
          failureEvents.push(ruleResult.event)
        }
      }

      return {
        events,
        failureEvents,
        almanac,
        results: ruleResults
      }
    })
  }
}

export default EngineUltra
