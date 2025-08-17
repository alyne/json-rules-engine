'use strict'

import ConditionUltra from './condition-ultra'
import RuleResult from '../rule-result'
import EventEmitter from 'eventemitter2'
import { debugEnabled, debug } from './debug-fast'
import { hasProp, PRIORITY_PROP } from './perf-utils'

class RuleUltra extends EventEmitter {
  /**
   * Ultra-optimized Rule with minimal debug overhead
   * @param {object} properties - rule properties
   */
  constructor (properties = {}) {
    super()
    if (typeof properties === 'string') {
      properties = JSON.parse(properties)
    }

    Object.assign(this, properties)
    this.priority = this.priority || 1
    this.conditions = new ConditionUltra(this.conditions)
    this.engine = null

    if (hasProp(properties, PRIORITY_PROP)) {
      this.setPriority(properties.priority)
    }
  }

  setConditions (conditions) {
    if (!conditions) throw new Error('Rule: setConditions() requires conditions')
    this.conditions = new ConditionUltra(conditions)
    return this
  }

  setEvent (event) {
    if (!event) throw new Error('Rule: setEvent() requires event object')
    if (!hasProp(event, 'type')) throw new Error('Rule: setEvent() requires event object with "type" property')
    this.event = event
    return this
  }

  setPriority (priority) {
    priority = parseInt(priority, 10)
    if (priority <= 0) throw new Error('Rule: setPriority() priority must be greater than zero')
    this.priority = priority
    return this
  }

  setName (name) {
    if (name === '') {
      throw new Error('Rule: setName() cannot be blank')
    }
    this.name = name
    return this
  }

  getName () {
    return this.name
  }

  getConditions () {
    return this.conditions
  }

  getEvent () {
    return this.event
  }

  getPriority () {
    return this.priority
  }

  setEngine (engine) {
    this.engine = engine
    return this
  }

  toJSON (stringify = true) {
    const props = {
      conditions: this.conditions.toJSON(false),
      priority: this.priority,
      event: this.event
    }
    if (this.name) {
      props.name = this.name
    }
    if (this.onSuccess) {
      props.onSuccess = this.onSuccess
    }
    if (this.onFailure) {
      props.onFailure = this.onFailure
    }
    if (stringify) {
      return JSON.stringify(props)
    }
    return props
  }

  /**
   * Ultra-optimized rule evaluation
   */
  evaluate (almanac) {
    const evaluationPromise = this.conditions.isBooleanOperator()
      ? this.conditions.evaluateBooleanCondition(almanac, this.engine.operators)
      : this.conditions.evaluate(almanac, this.engine.operators)
        .then(conditionResult => conditionResult.result)

    return evaluationPromise.then(ruleResult => {
      const ruleResultObj = new RuleResult(this.conditions, this.event, this.priority, this.name)
      ruleResultObj.result = ruleResult

      if (ruleResult) {
        this._processSuccess(ruleResultObj, almanac)
      } else {
        this._processFailure(ruleResultObj, almanac)
      }

      return ruleResultObj
    })
  }

  _processSuccess (ruleResult, almanac) {
    almanac.addEvent(ruleResult.event, 'success')
    if (debugEnabled) {
      debug('rule::fact-result', ruleResult.event)
    }
    this.emit('success', ruleResult.event, almanac, ruleResult)
    this.engine.emit('success', ruleResult.event, almanac, ruleResult)
    if (this.onSuccess) {
      this.onSuccess(ruleResult.event, almanac, ruleResult)
    }
  }

  _processFailure (ruleResult, almanac) {
    almanac.addEvent(ruleResult.event, 'failure')
    if (debugEnabled) {
      debug('rule::fact-result', ruleResult.event)
    }
    this.emit('failure', ruleResult.event, almanac, ruleResult)
    this.engine.emit('failure', ruleResult.event, almanac, ruleResult)
    if (this.onFailure) {
      this.onFailure(ruleResult.event, almanac, ruleResult)
    }
  }
}

export default RuleUltra
