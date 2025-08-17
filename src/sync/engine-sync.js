'use strict'

import FactSync from './fact-sync'
import RuleSync from './rule-sync'
import AlmanacSync from './almanac-sync'
import EventEmitter from 'eventemitter2'
import defaultOperators from '../engine-default-operators'
import defaultDecorators from '../engine-default-operator-decorators'
import debug from '../debug'
import ConditionSync from './condition-sync'
import OperatorMap from '../operator-map'

export const READY = 'READY'
export const RUNNING = 'RUNNING'
export const FINISHED = 'FINISHED'

class EngineSync extends EventEmitter {
  /**
   * Returns a new EngineSync instance
   * @param  {RuleSync[]} rules - array of rules to initialize with
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

  /**
   * Add a rule definition to the engine
   * @param {object|RuleSync} properties - rule definition
   */
  addRule (properties) {
    if (!properties) throw new Error('Engine: addRule() requires options')

    let rule
    if (properties instanceof RuleSync) {
      rule = properties
    } else {
      if (!Object.prototype.hasOwnProperty.call(properties, 'event')) throw new Error('Engine: addRule() argument requires "event" property')
      if (!Object.prototype.hasOwnProperty.call(properties, 'conditions')) throw new Error('Engine: addRule() argument requires "conditions" property')
      rule = new RuleSync(properties)
    }
    rule.setEngine(this)
    this.rules.push(rule)
    this.prioritizedRules = null
    return this
  }

  /**
   * update a rule in the engine
   * @param {object|RuleSync} rule - rule definition
   */
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

  /**
   * Remove a rule from the engine
   * @param {object|RuleSync|string} rule - rule definition
   */
  removeRule (rule) {
    let ruleRemoved = false
    if (!(rule instanceof RuleSync)) {
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

  /**
   * sets a condition that can be referenced by the given name
   * @param {string} name - the name of the condition to be referenced by rules
   * @param {object} conditions - the conditions to use when the condition is referenced
   */
  setCondition (name, conditions) {
    if (!name) throw new Error('Engine: setCondition() requires name')
    if (!conditions) throw new Error('Engine: setCondition() requires conditions')
    if (!Object.prototype.hasOwnProperty.call(conditions, 'all') && !Object.prototype.hasOwnProperty.call(conditions, 'any') && !Object.prototype.hasOwnProperty.call(conditions, 'not') && !Object.prototype.hasOwnProperty.call(conditions, 'condition')) {
      throw new Error('"conditions" root must contain a single instance of "all", "any", "not", or "condition"')
    }
    this.conditions.set(name, new ConditionSync(conditions))
    return this
  }

  /**
   * Removes a condition that has previously been added to this engine
   * @param {string} name - the name of the condition to remove
   * @returns true if the condition existed, otherwise false
   */
  removeCondition (name) {
    return this.conditions.delete(name)
  }

  /**
   * Add a custom operator definition
   * @param {string}   operatorOrName - operator identifier
   * @param {function(factValue, jsonValue)} callback - the method to execute when the operator is encountered
   */
  addOperator (operatorOrName, cb) {
    this.operators.addOperator(operatorOrName, cb)
  }

  /**
   * Remove a custom operator definition
   * @param {string}   operatorOrName - operator identifier
   */
  removeOperator (operatorOrName) {
    return this.operators.removeOperator(operatorOrName)
  }

  /**
   * Add a custom operator decorator
   * @param {string}   decoratorOrName - decorator identifier
   * @param {function(factValue, jsonValue, next)} callback - the method to execute when the decorator is encountered
   */
  addOperatorDecorator (decoratorOrName, cb) {
    this.operators.addOperatorDecorator(decoratorOrName, cb)
  }

  /**
   * Remove a custom operator decorator
   * @param {string}   decoratorOrName - decorator identifier
   */
  removeOperatorDecorator (decoratorOrName) {
    return this.operators.removeOperatorDecorator(decoratorOrName)
  }

  /**
   * Add a fact definition to the engine
   * @param {object|FactSync} id - fact identifier or instance of FactSync
   * @param {function} definitionFunc - function to be called when computing the fact value for a given rule
   * @param {Object} options - options to initialize the fact with
   */
  addFact (id, valueOrMethod, options) {
    let factId = id
    let fact
    if (id instanceof FactSync) {
      factId = id.id
      fact = id
    } else {
      fact = new FactSync(id, valueOrMethod, options)
    }
    debug('engine::addFact', { id: factId })
    this.facts.set(factId, fact)
    return this
  }

  /**
   * Remove a fact definition to the engine
   * @param {object|FactSync} id - fact identifier or instance of FactSync
   */
  removeFact (factOrId) {
    let factId
    if (!(factOrId instanceof FactSync)) {
      factId = factOrId
    } else {
      factId = factOrId.id
    }

    return this.facts.delete(factId)
  }

  /**
   * Iterates over the engine rules, organizing them by highest -> lowest priority
   * @return {RuleSync[][]} two dimensional array of Rules
   */
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

  /**
   * Stops the rules engine from running the next priority set of Rules
   * @return {EngineSync}
   */
  stop () {
    this.status = FINISHED
    return this
  }

  /**
   * Returns a fact by fact-id
   * @param  {string} factId - fact identifier
   * @return {FactSync} fact instance, or undefined if no such fact exists
   */
  getFact (factId) {
    return this.facts.get(factId)
  }

  /**
   * Runs an array of rules (synchronous)
   * @param  {RuleSync[]} array of rules to be evaluated
   * @return {Object} evaluation results
   */
  evaluateRules (ruleArray, almanac) {
    const results = []
    for (const rule of ruleArray) {
      if (this.status !== RUNNING) {
        debug('engine::run, skipping remaining rules', { status: this.status })
        break
      }
      const ruleResult = rule.evaluate(almanac)
      debug('engine::run', { ruleResult: ruleResult.result })
      almanac.addResult(ruleResult)
      if (ruleResult.result) {
        almanac.addEvent(ruleResult.event, 'success')
        this.emit('success', ruleResult.event, almanac, ruleResult)
        this.emit(ruleResult.event.type, ruleResult.event.params, almanac, ruleResult)
      } else {
        almanac.addEvent(ruleResult.event, 'failure')
        this.emit('failure', ruleResult.event, almanac, ruleResult)
      }
      results.push(ruleResult)
    }
    return results
  }

  /**
   * Runs the rules engine (synchronous)
   * @param  {Object} runtimeFacts - fact values known at runtime
   * @param  {Object} runOptions - run options
   * @return {Object} evaluation results
   */
  run (runtimeFacts = {}, runOptions = {}) {
    debug('engine::run started')
    this.status = RUNNING

    const almanac = runOptions.almanac || new AlmanacSync({
      allowUndefinedFacts: this.allowUndefinedFacts,
      pathResolver: this.pathResolver
    })

    this.facts.forEach(fact => {
      almanac.addFact(fact)
    })
    for (const factId in runtimeFacts) {
      let fact
      if (runtimeFacts[factId] instanceof FactSync) {
        fact = runtimeFacts[factId]
      } else {
        fact = new FactSync(factId, runtimeFacts[factId])
      }

      almanac.addFact(fact)
      debug('engine::run initialized runtime fact', { id: fact.id, value: fact.value, type: typeof fact.value })
    }

    const orderedSets = this.prioritizeRules()

    for (const set of orderedSets) {
      this.evaluateRules(set, almanac)
      if (this.status === FINISHED) break
    }

    this.status = FINISHED
    debug('engine::run completed')
    const ruleResults = almanac.getResults()
    const { results, failureResults } = ruleResults.reduce((hash, ruleResult) => {
      const group = ruleResult.result ? 'results' : 'failureResults'
      hash[group].push(ruleResult)
      return hash
    }, { results: [], failureResults: [] })

    return {
      almanac,
      results,
      failureResults,
      events: almanac.getEvents('success'),
      failureEvents: almanac.getEvents('failure')
    }
  }
}

export default EngineSync
