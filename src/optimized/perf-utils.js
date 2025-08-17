'use strict'

// Pre-compiled performance helpers to avoid repeated operations

// Cache for hasOwnProperty to avoid prototype lookup
const hasOwnProp = Object.prototype.hasOwnProperty

// Optimized hasOwnProperty check
export const hasProp = (obj, prop) => hasOwnProp.call(obj, prop)

// Fast object type check
export const isObject = (value) => value != null && typeof value === 'object'

// Fast fact reference check - checks if value is a fact reference object
export const isFactReference = (value) => isObject(value) && hasProp(value, 'fact')

// Fast shallow clone for simple objects (faster than deepClone for rule results)
export const shallowClone = (obj) => {
  if (!isObject(obj)) return obj
  if (Array.isArray(obj)) return obj.slice()
  return Object.assign({}, obj)
}

// Pre-compile common property names for faster access
export const FACT_PROP = 'fact'
export const OPERATOR_PROP = 'operator'
export const VALUE_PROP = 'value'
export const CONDITIONS_PROP = 'conditions'
export const EVENT_PROP = 'event'
export const PRIORITY_PROP = 'priority'
export const NAME_PROP = 'name'
export const CONDITION_PROP = 'condition'
export const ALL_PROP = 'all'
export const ANY_PROP = 'any'
export const NOT_PROP = 'not'
