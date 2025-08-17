'use strict'

import ConditionFast from './condition-fast'
import RuleResult from '../rule-result'
import deepClone from 'clone'
import EventEmitter from 'eventemitter2'

class RuleFast extends EventEmitter {
  /**
   * returns a new RuleFast instance - optimized for performance
   * @param {object,string} options, or json string that can be parsed into options
   * @param {integer} options.priority (>1) - higher runs sooner.
   * @param {Object} options.event - event to fire when rule evaluates as successful
   * @param {string} options.event.type - name of event to emit
   * @param {string} options.event.params - parameters to pass to the event listener
   * @param {Object} options.conditions - conditions to evaluate when processing this rule
   * @param {any} options.name - identifier for a particular rule, particularly valuable in RuleResult output
   * @return {RuleFast} instance
   */
  constructor (options) {
    super()
    if (typeof options === 'string') {
      options = JSON.parse(options)
    }
    if (options && options.conditions) {
      this.setConditions(options.conditions)
    }
    if (options && options.onSuccess) {
      this.on('success', options.onSuccess)
    }
    if (options && options.onFailure) {
      this.on('failure', options.onFailure)
    }
    if (options && (options.name || options.name === 0)) {
      this.setName(options.name)
    }

    const priority = (options && options.priority) || 1
    this.setPriority(priority)

    const event = (options && options.event) || { type: 'unknown' }
    this.setEvent(event)
  }

  setPriority (priority) {
    priority = parseInt(priority, 10)
    if (priority <= 0) throw new Error('Priority must be greater than zero')
    this.priority = priority
    return this
  }

  setName (name) {
    if (!name && name !== 0) {
      throw new Error('Rule "name" must be defined')
    }
    this.name = name
    return this
  }

  setConditions (conditions) {
    if (
      !Object.prototype.hasOwnProperty.call(conditions, 'all') &&
      !Object.prototype.hasOwnProperty.call(conditions, 'any') &&
      !Object.prototype.hasOwnProperty.call(conditions, 'not') &&
      !Object.prototype.hasOwnProperty.call(conditions, 'condition')
    ) {
      throw new Error(
        '"conditions" root must contain a single instance of "all", "any", "not", or "condition"'
      )
    }
    this.conditions = new ConditionFast(conditions)
    return this
  }

  setEvent (event) {
    if (!event) throw new Error('Rule: setEvent() requires event object')
    if (!Object.prototype.hasOwnProperty.call(event, 'type')) {
      throw new Error(
        'Rule: setEvent() requires event object with "type" property'
      )
    }
    this.ruleEvent = {
      type: event.type
    }
    this.event = this.ruleEvent
    if (event.params) this.ruleEvent.params = event.params
    return this
  }

  getEvent () {
    return this.ruleEvent
  }

  getPriority () {
    return this.priority
  }

  getConditions () {
    return this.conditions
  }

  getEngine () {
    return this.engine
  }

  setEngine (engine) {
    this.engine = engine
    return this
  }

  toJSON (stringify = true) {
    const props = {
      conditions: this.conditions.toJSON(false),
      priority: this.priority,
      event: this.ruleEvent,
      name: this.name
    }
    if (stringify) {
      return JSON.stringify(props)
    }
    return props
  }

  prioritizeConditions (conditions) {
    const factSets = conditions.reduce((sets, condition) => {
      let priority = condition.priority
      if (!priority) {
        const fact = this.engine.getFact(condition.fact)
        priority = (fact && fact.priority) || 1
      }
      if (!sets[priority]) sets[priority] = []
      sets[priority].push(condition)
      return sets
    }, {})
    return Object.keys(factSets)
      .sort((a, b) => {
        return Number(a) > Number(b) ? -1 : 1
      })
      .map((priority) => factSets[priority])
  }

  /**
   * Optimized rule evaluation using smart short-circuiting
   * @return {Promise(RuleResult)} rule evaluation result
   */
  evaluate (almanac) {
    const ruleResult = new RuleResult(
      this.conditions,
      this.ruleEvent,
      this.priority,
      this.name
    )

    /**
     * Optimized condition evaluation with built-in short-circuiting
     */
    const evaluateCondition = (condition) => {
      if (condition.isConditionReference()) {
        return realize(condition)
      } else if (condition.isBooleanOperator()) {
        // Use optimized boolean evaluation with short-circuiting
        return condition.evaluateBooleanCondition(almanac, this.engine.operators)
          .then(result => {
            condition.result = result
            return result
          })
      } else {
        return condition.evaluate(almanac, this.engine.operators)
          .then(evaluationResult => {
            const passes = evaluationResult.result
            condition.factResult = evaluationResult.leftHandSideValue
            condition.valueResult = evaluationResult.rightHandSideValue
            condition.result = passes
            return passes
          })
      }
    }

    /**
     * Dereferences the condition reference and then evaluates it.
     */
    const realize = (conditionReference) => {
      const condition = this.engine.conditions.get(conditionReference.condition)
      if (!condition) {
        if (this.engine.allowUndefinedConditions) {
          conditionReference.result = false
          return Promise.resolve(false)
        } else {
          return Promise.reject(new Error(
            `No condition ${conditionReference.condition} exists`
          ))
        }
      } else {
        delete conditionReference.condition
        Object.assign(conditionReference, deepClone(condition))
        return evaluateCondition(conditionReference)
      }
    }

    /**
     * Process rule result and emit events
     */
    const processResult = (result) => {
      ruleResult.setResult(result)
      let processEvent = Promise.resolve()
      if (this.engine.replaceFactsInEventParams) {
        processEvent = ruleResult.resolveEventParams(almanac)
      }
      const event = result ? 'success' : 'failure'
      return processEvent
        .then(() => this.emitAsync(event, ruleResult.event, almanac, ruleResult))
        .then(() => ruleResult)
    }

    // Leverage ConditionFast's built-in boolean evaluation with short-circuiting
    return evaluateCondition(this.conditions)
      .then(result => processResult(result))
  }
}

export default RuleFast
