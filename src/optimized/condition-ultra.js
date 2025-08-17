'use strict'

import { debug, debugEnabled } from './debug-fast'

export default class ConditionUltra {
  constructor (properties) {
    if (!properties) throw new Error('Condition: constructor options required')
    const booleanOperator = ConditionUltra.booleanOperator(properties)
    Object.assign(this, properties)
    if (booleanOperator) {
      const subConditions = properties[booleanOperator]
      const subConditionsIsArray = Array.isArray(subConditions)
      if (booleanOperator !== 'not' && !subConditionsIsArray) { throw new Error(`"${booleanOperator}" must be an array`) }
      if (booleanOperator === 'not' && subConditionsIsArray) { throw new Error(`"${booleanOperator}" cannot be an array`) }
      this.operator = booleanOperator
      this.priority = parseInt(properties.priority, 10) || 1
      if (subConditionsIsArray) {
        this[booleanOperator] = subConditions.map((c) => new ConditionUltra(c))
      } else {
        this[booleanOperator] = new ConditionUltra(subConditions)
      }
    } else if (!Object.prototype.hasOwnProperty.call(properties, 'condition')) {
      if (!Object.prototype.hasOwnProperty.call(properties, 'fact')) { throw new Error('Condition: constructor "fact" property required') }
      if (!Object.prototype.hasOwnProperty.call(properties, 'operator')) { throw new Error('Condition: constructor "operator" property required') }
      if (!Object.prototype.hasOwnProperty.call(properties, 'value')) { throw new Error('Condition: constructor "value" property required') }

      if (Object.prototype.hasOwnProperty.call(properties, 'priority')) {
        properties.priority = parseInt(properties.priority, 10)
      }
    }
  }

  toJSON (stringify = true) {
    const props = {}
    if (this.priority) {
      props.priority = this.priority
    }
    if (this.name) {
      props.name = this.name
    }
    const oper = ConditionUltra.booleanOperator(this)
    if (oper) {
      if (Array.isArray(this[oper])) {
        props[oper] = this[oper].map((c) => c.toJSON(false))
      } else {
        props[oper] = this[oper].toJSON(false)
      }
    } else if (this.isConditionReference()) {
      props.condition = this.condition
    } else {
      props.operator = this.operator
      props.value = this.value
      props.fact = this.fact
      if (this.factResult !== undefined) {
        props.factResult = this.factResult
      }
      if (this.valueResult !== undefined) {
        props.valueResult = this.valueResult
      }
      if (this.result !== undefined) {
        props.result = this.result
      }
      if (this.params) {
        props.params = this.params
      }
      if (this.path) {
        props.path = this.path
      }
    }
    if (stringify) {
      return JSON.stringify(props)
    }
    return props
  }

  /**
   * Ultra-optimized condition evaluation with no debug overhead in production
   */
  evaluate (almanac, operatorMap) {
    if (!almanac) return Promise.reject(new Error('almanac required'))
    if (!operatorMap) return Promise.reject(new Error('operatorMap required'))
    if (this.isBooleanOperator()) { return Promise.reject(new Error('Cannot evaluate() a boolean condition')) }

    const op = operatorMap.get(this.operator)
    if (!op) { return Promise.reject(new Error(`Unknown operator: ${this.operator}`)) }

    // Fast path optimization: check if value is a constant (not a fact reference)
    const isValueConstant = !(this.value != null && typeof this.value === 'object' &&
                             Object.prototype.hasOwnProperty.call(this.value, 'fact'))

    if (isValueConstant) {
      // Fast path: value is constant, only need to resolve fact
      return almanac.factValue(this.fact, this.params, this.path)
        .then(leftHandSideValue => {
          const result = op.evaluate(leftHandSideValue, this.value)
          if (debugEnabled) {
            debug('condition::evaluate', {
              leftHandSideValue,
              operator: this.operator,
              rightHandSideValue: this.value,
              result
            })
          }
          return {
            result,
            leftHandSideValue,
            rightHandSideValue: this.value,
            operator: this.operator
          }
        })
    } else {
      // Original path: both fact and value need resolution
      return Promise.all([
        almanac.getValue(this.value),
        almanac.factValue(this.fact, this.params, this.path)
      ]).then(([rightHandSideValue, leftHandSideValue]) => {
        const result = op.evaluate(leftHandSideValue, rightHandSideValue)
        if (debugEnabled) {
          debug('condition::evaluate', {
            leftHandSideValue,
            operator: this.operator,
            rightHandSideValue,
            result
          })
        }
        return {
          result,
          leftHandSideValue,
          rightHandSideValue,
          operator: this.operator
        }
      })
    }
  }

  /**
   * Ultra-optimized boolean evaluation with smart short-circuiting and no debug overhead
   */
  evaluateBooleanCondition (almanac, operatorMap) {
    if (!this.isBooleanOperator()) {
      return Promise.reject(new Error('evaluateBooleanCondition() can only evaluate boolean conditions'))
    }

    const operator = this.booleanOperator()
    const conditions = this[operator]

    if (debugEnabled) {
      debug('condition::evaluateBooleanCondition', { operator })
    }

    if (operator === 'not') {
      if (conditions.isBooleanOperator()) {
        return conditions.evaluateBooleanCondition(almanac, operatorMap)
          .then(result => !result)
      } else {
        return conditions.evaluate(almanac, operatorMap)
          .then(result => !result.result)
      }
    }

    // Smart short-circuiting for 'any' and 'all'
    if (operator === 'any') {
      // Short-circuit on first true result
      const evaluateNext = (index) => {
        if (index >= conditions.length) {
          return Promise.resolve(false)
        }

        const condition = conditions[index]
        const evaluation = condition.isBooleanOperator()
          ? condition.evaluateBooleanCondition(almanac, operatorMap)
          : condition.evaluate(almanac, operatorMap)

        return evaluation.then(result => {
          const isTrue = result === true || (result && result.result === true)
          if (isTrue) {
            if (debugEnabled) {
              debug('condition::any short-circuit success')
            }
            return true
          }
          return evaluateNext(index + 1)
        })
      }
      return evaluateNext(0)
    }

    if (operator === 'all') {
      // Short-circuit on first false result
      const evaluateNext = (index) => {
        if (index >= conditions.length) {
          return Promise.resolve(true)
        }

        const condition = conditions[index]
        const evaluation = condition.isBooleanOperator()
          ? condition.evaluateBooleanCondition(almanac, operatorMap)
          : condition.evaluate(almanac, operatorMap)

        return evaluation.then(result => {
          const isFalse = result === false || (result && result.result === false)
          if (isFalse) {
            if (debugEnabled) {
              debug('condition::all short-circuit failure')
            }
            return false
          }
          return evaluateNext(index + 1)
        })
      }
      return evaluateNext(0)
    }

    return Promise.reject(new Error(`Unknown boolean operator: ${operator}`))
  }

  static booleanOperator (condition) {
    if (Object.prototype.hasOwnProperty.call(condition, 'any')) {
      return 'any'
    } else if (Object.prototype.hasOwnProperty.call(condition, 'all')) {
      return 'all'
    } else if (Object.prototype.hasOwnProperty.call(condition, 'not')) {
      return 'not'
    }
  }

  booleanOperator () {
    return ConditionUltra.booleanOperator(this)
  }

  isBooleanOperator () {
    return ConditionUltra.booleanOperator(this) !== undefined
  }

  isConditionReference () {
    return Object.prototype.hasOwnProperty.call(this, 'condition')
  }
}
