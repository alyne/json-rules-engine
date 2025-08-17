'use strict'

import ConditionSync from './condition-sync'
import RuleResult from '../rule-result'
import debug from '../debug'
import deepClone from 'clone'
import EventEmitter from 'eventemitter2'

class RuleSync extends EventEmitter {
  /**
   * returns a new Rule instance
   * @param {object,string} options, or json string that can be parsed into options
   * @param {integer} options.priority (>1) - higher runs sooner.
   * @param {Object} options.event - event to fire when rule evaluates as successful
   * @param {string} options.event.type - name of event to emit
   * @param {string} options.event.params - parameters to pass to the event listener
   * @param {Object} options.conditions - conditions to evaluate when processing this rule
   * @param {any} options.name - identifier for a particular rule, particularly valuable in RuleResult output
   * @return {RuleSync} instance
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

  /**
   * Sets the priority of the rule
   * @param {integer} priority (>=1) - increasing the priority causes the rule to be run prior to other rules
   */
  setPriority (priority) {
    priority = parseInt(priority, 10)
    if (priority <= 0) throw new Error('Priority must be greater than zero')
    this.priority = priority
    return this
  }

  /**
   * Sets the name of the rule
   * @param {any} name - any truthy input and zero is allowed
   */
  setName (name) {
    if (!name && name !== 0) {
      throw new Error('Rule "name" must be defined')
    }
    this.name = name
    return this
  }

  /**
   * Sets the conditions to run when evaluating the rule.
   * @param {object} conditions - conditions, root element must be a boolean operator
   */
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
    this.conditions = new ConditionSync(conditions)
    return this
  }

  /**
   * Sets the event to emit when the conditions evaluate truthy
   * @param {object} event - event to emit
   * @param {string} event.type - event name to emit on
   * @param {string} event.params - parameters to emit as the argument of the event emission
   */
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

  /**
   * returns the event object
   * @returns {Object} event
   */
  getEvent () {
    return this.ruleEvent
  }

  /**
   * returns the priority
   * @returns {Number} priority
   */
  getPriority () {
    return this.priority
  }

  /**
   * returns the event object
   * @returns {Object} event
   */
  getConditions () {
    return this.conditions
  }

  /**
   * returns the engine object
   * @returns {Object} engine
   */
  getEngine () {
    return this.engine
  }

  /**
   * Sets the engine to run the rules under
   * @param {object} engine
   * @returns {RuleSync}
   */
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

  /**
   * Priorizes an array of conditions based on "priority"
   * @param  {ConditionSync[]} conditions
   * @return {ConditionSync[][]} prioritized two-dimensional array of conditions
   */
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
   * Evaluates the rule, starting with the root boolean operator and recursing down (synchronous)
   * @return {RuleResult} rule evaluation result
   */
  evaluate (almanac) {
    const ruleResult = new RuleResult(
      this.conditions,
      this.ruleEvent,
      this.priority,
      this.name
    )

    /**
     * Evaluates the rule conditions (synchronous)
     * @param  {ConditionSync} condition - condition to evaluate
     * @return {boolean} - result of the condition evaluation
     */
    const evaluateCondition = (condition) => {
      if (condition.isConditionReference()) {
        return realize(condition)
      } else if (condition.isBooleanOperator()) {
        const subConditions = condition[condition.operator]
        let comparisonValue
        if (condition.operator === 'all') {
          comparisonValue = all(subConditions)
        } else if (condition.operator === 'any') {
          comparisonValue = any(subConditions)
        } else {
          comparisonValue = not(subConditions)
        }
        const passes = comparisonValue === true
        condition.result = passes
        return passes
      } else {
        const evaluationResult = condition.evaluate(almanac, this.engine.operators)
        const passes = evaluationResult.result
        condition.factResult = evaluationResult.leftHandSideValue
        condition.valueResult = evaluationResult.rightHandSideValue
        condition.result = passes
        return passes
      }
    }

    /**
     * Evalutes an array of conditions, using an 'every' or 'some' array operation (synchronous)
     * @param  {ConditionSync[]} conditions
     * @param  {string(every|some)} array method to call for determining result
     * @return {boolean} whether conditions evaluated truthy or falsey
     */
    const evaluateConditions = (conditions, method) => {
      if (!Array.isArray(conditions)) conditions = [conditions]

      const conditionResults = conditions.map((condition) => evaluateCondition(condition))
      debug('rule::evaluateConditions', { results: conditionResults })
      return method.call(conditionResults, (result) => result === true)
    }

    /**
     * Evaluates a set of conditions based on an 'all', 'any', or 'not' operator (synchronous)
     * @param  {ConditionSync[]} conditions - conditions to be evaluated
     * @param  {string('all'|'any'|'not')} operator
     * @return {boolean} rule evaluation result
     */
    const prioritizeAndRun = (conditions, operator) => {
      if (conditions.length === 0) {
        return true
      }
      if (conditions.length === 1) {
        return evaluateCondition(conditions[0])
      }
      const orderedSets = this.prioritizeConditions(conditions)
      let result = operator === 'all'

      for (let i = 0; i < orderedSets.length; i++) {
        const set = orderedSets[i]
        if (operator === 'any') {
          result = result || evaluateConditions(set, Array.prototype.some)
          if (result) break // short-circuit for 'any'
        } else {
          result = result && evaluateConditions(set, Array.prototype.every)
          if (!result) break // short-circuit for 'all'
        }
      }
      return result
    }

    /**
     * Runs an 'any' boolean operator on an array of conditions (synchronous)
     * @param  {ConditionSync[]} conditions to be evaluated
     * @return {boolean} condition evaluation result
     */
    const any = (conditions) => {
      return prioritizeAndRun(conditions, 'any')
    }

    /**
     * Runs an 'all' boolean operator on an array of conditions (synchronous)
     * @param  {ConditionSync[]} conditions to be evaluated
     * @return {boolean} condition evaluation result
     */
    const all = (conditions) => {
      return prioritizeAndRun(conditions, 'all')
    }

    /**
     * Runs a 'not' boolean operator on a single condition (synchronous)
     * @param  {ConditionSync} condition to be evaluated
     * @return {boolean} condition evaluation result
     */
    const not = (condition) => {
      return !prioritizeAndRun([condition], 'not')
    }

    /**
     * Dereferences the condition reference and then evaluates it (synchronous)
     * @param {ConditionSync} conditionReference
     * @returns {boolean} condition evaluation result
     */
    const realize = (conditionReference) => {
      const condition = this.engine.conditions.get(conditionReference.condition)
      if (!condition) {
        if (this.engine.allowUndefinedConditions) {
          conditionReference.result = false
          return false
        } else {
          throw new Error(
            `No condition ${conditionReference.condition} exists`
          )
        }
      } else {
        delete conditionReference.condition
        Object.assign(conditionReference, deepClone(condition))
        return evaluateCondition(conditionReference)
      }
    }

    /**
     * Emits based on rule evaluation result, and decorates ruleResult with 'result' property (synchronous)
     * @param {boolean} result
     */
    const processResult = (result) => {
      ruleResult.setResult(result)

      if (this.engine.replaceFactsInEventParams) {
        ruleResult.resolveEventParamsSync(almanac)
      }
      const event = result ? 'success' : 'failure'
      this.emit(event, ruleResult.event, almanac, ruleResult)
      return ruleResult
    }

    if (ruleResult.conditions.any) {
      const result = any(ruleResult.conditions.any)
      return processResult(result)
    } else if (ruleResult.conditions.all) {
      const result = all(ruleResult.conditions.all)
      return processResult(result)
    } else if (ruleResult.conditions.not) {
      const result = not(ruleResult.conditions.not)
      return processResult(result)
    } else {
      const result = realize(ruleResult.conditions)
      return processResult(result)
    }
  }
}

export default RuleSync
