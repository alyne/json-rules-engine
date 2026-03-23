'use strict'

import Fact from '../fact'
import RuleFast from './rule-fast'
import AlmanacFast from './almanac-fast'
import EventEmitter from 'eventemitter2'
import defaultOperators from '../engine-default-operators'
import defaultDecorators from '../engine-default-operator-decorators'
import debug from '../debug'
import ConditionFast from './condition-fast'
import OperatorMap from '../operator-map'

export const READY = 'READY'
export const RUNNING = 'RUNNING'
export const FINISHED = 'FINISHED'

class EngineFast extends EventEmitter {
  /**
   * Returns a new optimized Engine instance with performance enhancements
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
    rules.map(r => this.addRule(r))
    defaultOperators.map(o => this.addOperator(o))
    defaultDecorators.map(d => this.addOperatorDecorator(d))
  }

  addRule (properties) {
    if (!properties) throw new Error('Engine: addRule() requires options')

    let rule
    if (properties instanceof RuleFast) {
      rule = properties
    } else {
      if (!Object.prototype.hasOwnProperty.call(properties, 'event')) throw new Error('Engine: addRule() argument requires "event" property')
      if (!Object.prototype.hasOwnProperty.call(properties, 'conditions')) throw new Error('Engine: addRule() argument requires "conditions" property')
      rule = new RuleFast(properties)
    }
    rule.setEngine(this)
    this.rules.push(rule)
    this.prioritizedRules = null
    return this
  }

  updateRule (rule) {
    const ruleIndex = this.rules.findIndex(ruleInEngine => ruleInEngine.name === rule.name)
    if (ruleIndex > -1) {
      this.rules.splice(ruleIndex, 1)
      this.addRule(rule)
      this.prioritizedRules = null
    } else {
      throw new Error('Engine: updateRule() rule not found')
    }
  }

  removeRule (rule) {
    let ruleRemoved = false
    if (!(rule instanceof RuleFast)) {
      const filteredRules = this.rules.filter(ruleInEngine => ruleInEngine.name !== rule)
      ruleRemoved = filteredRules.length !== this.rules.length
      this.rules = filteredRules
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
    if (!Object.prototype.hasOwnProperty.call(conditions, 'all') && !Object.prototype.hasOwnProperty.call(conditions, 'any') && !Object.prototype.hasOwnProperty.call(conditions, 'not') && !Object.prototype.hasOwnProperty.call(conditions, 'condition')) {
      throw new Error('"conditions" root must contain a single instance of "all", "any", "not", or "condition"')
    }
    this.conditions.set(name, new ConditionFast(conditions))
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
      fact = new Fact(id, valueOrMethod, options)
    }
    debug('engine::addFact', { id: factId })
    this.facts.set(factId, fact)
    return this
  }

  removeFact (factOrId) {
    let factId
    if (!(factOrId instanceof Fact)) {
      factId = factOrId
    } else {
      factId = factOrId.id
    }
    return this.facts.delete(factId)
  }

  prioritizeRules () {
    if (!this.prioritizedRules) {
      const ruleSets = this.rules.reduce((sets, rule) => {
        const priority = rule.priority
        if (!sets[priority]) sets[priority] = []
        sets[priority].push(rule)
        return sets
      }, {})
      this.prioritizedRules = Object.keys(ruleSets).sort((a, b) => {
        return Number(a) > Number(b) ? -1 : 1
      }).map((priority) => ruleSets[priority])
    }
    return this.prioritizedRules
  }

  stop () {
    this.status = FINISHED
    return this
  }

  getFact (factId) {
    return this.facts.get(factId)
  }

  /**
   * Optimized parallel rule evaluation with better async handling
   * @param  {Rule[]} array of rules to be evaluated
   * @return {Promise} resolves when all rules in the array have been evaluated
   */
  evaluateRules (ruleArray, almanac) {
    return Promise.all(ruleArray.map((rule) => {
      if (this.status !== RUNNING) {
        debug('engine::run, skipping remaining rules', { status: this.status })
        return Promise.resolve()
      }

      return rule.evaluate(almanac).then((ruleResult) => {
        debug('engine::run', { ruleResult: ruleResult.result })
        almanac.addResult(ruleResult)

        if (ruleResult.result) {
          almanac.addEvent(ruleResult.event, 'success')
          return this.emitAsync('success', ruleResult.event, almanac, ruleResult)
            .then(() => this.emitAsync(ruleResult.event.type, ruleResult.event.params, almanac, ruleResult))
        } else {
          almanac.addEvent(ruleResult.event, 'failure')
          return this.emitAsync('failure', ruleResult.event, almanac, ruleResult)
        }
      }).catch(error => {
        debug('engine::evaluateRules error', { error: error.message })
        throw error
      })
    }))
  }

  /**
   * Optimized engine run with better async flow and caching
   * @param  {Object} runtimeFacts - fact values known at runtime
   * @param  {Object} runOptions - run options
   * @return {Promise} resolves when the engine has completed running
   */
  run (runtimeFacts = {}, runOptions = {}) {
    debug('engine::run started')
    this.status = RUNNING

    // Use optimized almanac
    const almanac = runOptions.almanac || new AlmanacFast({
      allowUndefinedFacts: this.allowUndefinedFacts,
      pathResolver: this.pathResolver
    })

    // Add engine facts to almanac
    this.facts.forEach(fact => {
      almanac.addFact(fact)
    })

    // Add runtime facts
    for (const factId in runtimeFacts) {
      let fact
      if (runtimeFacts[factId] instanceof Fact) {
        fact = runtimeFacts[factId]
      } else {
        fact = new Fact(factId, runtimeFacts[factId])
      }
      almanac.addFact(fact)
      debug('engine::run initialized runtime fact', { id: fact.id, value: fact.value, type: typeof fact.value })
    }

    const orderedSets = this.prioritizeRules()
    let cursor = Promise.resolve()

    // Optimized priority set processing with better error handling
    return new Promise((resolve, reject) => {
      orderedSets.map((set) => {
        cursor = cursor.then(() => {
          if (this.status !== RUNNING) {
            debug('engine::run, stopping due to status change', { status: this.status })
            return Promise.resolve()
          }
          return this.evaluateRules(set, almanac)
        }).catch(reject)
        return cursor
      })

      cursor.then(() => {
        this.status = FINISHED
        debug('engine::run completed')

        const ruleResults = almanac.getResults()
        const { results, failureResults } = ruleResults.reduce((hash, ruleResult) => {
          const group = ruleResult.result ? 'results' : 'failureResults'
          hash[group].push(ruleResult)
          return hash
        }, { results: [], failureResults: [] })

        resolve({
          almanac,
          results,
          failureResults,
          events: almanac.getEvents('success'),
          failureEvents: almanac.getEvents('failure')
        })
      }).catch(reject)
    })
  }
}

export default EngineFast
