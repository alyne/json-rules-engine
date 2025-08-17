'use strict'

import debug from '../debug'

export default class ConditionSync {
  constructor (properties) {
    if (!properties) throw new Error('Condition: constructor options required')
    const booleanOperator = ConditionSync.booleanOperator(properties)
    Object.assign(this, properties)
    if (booleanOperator) {
      const subConditions = properties[booleanOperator]
      const subConditionsIsArray = Array.isArray(subConditions)
      if (booleanOperator !== 'not' && !subConditionsIsArray) { throw new Error(`"${booleanOperator}" must be an array`) }
      if (booleanOperator === 'not' && subConditionsIsArray) { throw new Error(`"${booleanOperator}" cannot be an array`) }
      this.operator = booleanOperator
      this.priority = parseInt(properties.priority, 10) || 1
      if (subConditionsIsArray) {
        this[booleanOperator] = subConditions.map((c) => new ConditionSync(c))
      } else {
        this[booleanOperator] = new ConditionSync(subConditions)
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

  /**
   * Converts the condition into a json-friendly structure
   * @param   {Boolean} stringify - whether to return as a json string
   * @returns {string,object} json string or json-friendly object
   */
  toJSON (stringify = true) {
    const props = {}
    if (this.priority) {
      props.priority = this.priority
    }
    if (this.name) {
      props.name = this.name
    }
    const oper = ConditionSync.booleanOperator(this)
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
   * Takes the fact result and compares it to the condition 'value', using the operator (synchronous)
   * @param   {AlmanacSync} almanac
   * @param   {Map} operatorMap - map of available operators, keyed by operator name
   * @returns {Object} - evaluation result
   */
  evaluate (almanac, operatorMap) {
    if (!almanac) throw new Error('almanac required')
    if (!operatorMap) throw new Error('operatorMap required')
    if (this.isBooleanOperator()) { throw new Error('Cannot evaluate() a boolean condition') }

    const op = operatorMap.get(this.operator)
    if (!op) { throw new Error(`Unknown operator: ${this.operator}`) }

    const rightHandSideValue = almanac.getValue(this.value)
    const leftHandSideValue = almanac.factValue(this.fact, this.params, this.path)

    const result = op.evaluate(leftHandSideValue, rightHandSideValue)
    debug(
      'condition::evaluate', {
        leftHandSideValue,
        operator: this.operator,
        rightHandSideValue,
        result
      }
    )
    return {
      result,
      leftHandSideValue,
      rightHandSideValue,
      operator: this.operator
    }
  }

  /**
   * Returns the boolean operator for the condition
   * If the condition is not a boolean condition, the result will be 'undefined'
   * @return {string 'all', 'any', or 'not'}
   */
  static booleanOperator (condition) {
    if (Object.prototype.hasOwnProperty.call(condition, 'any')) {
      return 'any'
    } else if (Object.prototype.hasOwnProperty.call(condition, 'all')) {
      return 'all'
    } else if (Object.prototype.hasOwnProperty.call(condition, 'not')) {
      return 'not'
    }
  }

  /**
   * Returns the condition's boolean operator
   * Instance version of ConditionSync.isBooleanOperator
   * @returns {string,undefined} - 'any', 'all', 'not' or undefined (if not a boolean condition)
   */
  booleanOperator () {
    return ConditionSync.booleanOperator(this)
  }

  /**
   * Whether the operator is boolean ('all', 'any', 'not')
   * @returns {Boolean}
   */
  isBooleanOperator () {
    return ConditionSync.booleanOperator(this) !== undefined
  }

  /**
   * Whether the condition represents a reference to a condition
   * @returns {Boolean}
   */
  isConditionReference () {
    return Object.prototype.hasOwnProperty.call(this, 'condition')
  }
}
