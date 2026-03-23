'use strict'

import Fact from '../fact'
import { UndefinedFactError } from '../errors'
import debug from '../debug'
import { JSONPath } from 'jsonpath-plus'

function defaultPathResolver (value, path) {
  return JSONPath({ path, json: value, wrap: false })
}

/**
 * Optimized fact results lookup with fast-path for cache hits and constants
 */
export default class AlmanacFast {
  constructor (options = {}) {
    this.factMap = new Map()
    this.factResultsCache = new Map() // { cacheKey: actualValue } - no Promise wrapping
    this.factPromiseCache = new Map() // { cacheKey: Promise } - only for truly async facts
    this.pathCache = new Map() // Pre-compiled JSONPath expressions
    this.allowUndefinedFacts = Boolean(options.allowUndefinedFacts)
    this.pathResolver = options.pathResolver || defaultPathResolver
    this.events = { success: [], failure: [] }
    this.ruleResults = []
  }

  addEvent (event, outcome) {
    if (!outcome) throw new Error('outcome required: "success" | "failure"]')
    this.events[outcome].push(event)
  }

  getEvents (outcome = '') {
    if (outcome) return this.events[outcome]
    return this.events.success.concat(this.events.failure)
  }

  addResult (ruleResult) {
    this.ruleResults.push(ruleResult)
  }

  getResults () {
    return this.ruleResults
  }

  _getFact (factId) {
    return this.factMap.get(factId)
  }

  _addConstantFact (fact) {
    this.factMap.set(fact.id, fact)
    // Store actual value, not Promise
    this._setFactValue(fact, {}, fact.value)
  }

  /**
   * Optimized fact value setting - stores actual values for sync access
   */
  _setFactValue (fact, params, value) {
    const cacheKey = fact.getCacheKey(params)
    if (cacheKey) {
      // Check if value is a Promise
      if (value && typeof value.then === 'function') {
        this.factPromiseCache.set(cacheKey, value)
        return value.then(resolvedValue => {
          this.factResultsCache.set(cacheKey, resolvedValue)
          this.factPromiseCache.delete(cacheKey)
          return resolvedValue
        })
      } else {
        // Direct value storage for sync facts
        this.factResultsCache.set(cacheKey, value)
        return Promise.resolve(value)
      }
    }
    return Promise.resolve(value)
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
    debug('almanac::addFact', { id: factId })
    this.factMap.set(factId, fact)
    if (fact.isConstant()) {
      this._setFactValue(fact, {}, fact.value)
    }
    return this
  }

  addRuntimeFact (factId, value) {
    debug('almanac::addRuntimeFact', { id: factId })
    const fact = new Fact(factId, value)
    return this._addConstantFact(fact)
  }

  /**
   * Optimized fact value resolution with fast-path for cache hits
   */
  factValue (factId, params = {}, path = '') {
    const fact = this._getFact(factId)
    if (fact === undefined) {
      if (this.allowUndefinedFacts) {
        return Promise.resolve(undefined)
      } else {
        return Promise.reject(new UndefinedFactError(`Undefined fact: ${factId}`))
      }
    }

    let factValuePromise
    if (fact.isConstant()) {
      // Fast path for constants
      const value = fact.calculate(params, this)
      factValuePromise = Promise.resolve(value)
    } else {
      const cacheKey = fact.getCacheKey(params)

      // Fast path for cache hits - return actual value directly
      const cachedValue = cacheKey && this.factResultsCache.get(cacheKey)
      if (cachedValue !== undefined) {
        debug('almanac::factValue cache hit for fact', { id: factId })
        factValuePromise = Promise.resolve(cachedValue)
      } else {
        // Check if there's a pending Promise for this fact
        const pendingPromise = cacheKey && this.factPromiseCache.get(cacheKey)
        if (pendingPromise) {
          factValuePromise = pendingPromise
        } else {
          debug('almanac::factValue cache miss, calculating', { id: factId })
          factValuePromise = this._setFactValue(fact, params, fact.calculate(params, this))
        }
      }
    }

    if (path) {
      return this._applyPath(factValuePromise, path)
    }

    return factValuePromise
  }

  /**
   * Optimized path resolution with caching
   */
  _applyPath (factValuePromise, path) {
    return factValuePromise.then(factValue => {
      if (factValue != null && typeof factValue === 'object') {
        // Cache compiled path expressions
        let compiledPath = this.pathCache.get(path)
        if (!compiledPath) {
          compiledPath = { path, json: null, wrap: false }
          this.pathCache.set(path, compiledPath)
        }

        compiledPath.json = factValue
        const pathValue = JSONPath(compiledPath)
        debug('condition::evaluate extracting object', { property: path, received: pathValue })
        return pathValue
      } else {
        debug('condition::evaluate could not compute object path of non-object', { path, factValue, type: typeof factValue })
        return factValue
      }
    })
  }

  /**
   * Optimized value resolution - fast path for primitives
   */
  getValue (value) {
    if (value != null && typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'fact')) {
      return this.factValue(value.fact, value.params, value.path)
    }
    return Promise.resolve(value)
  }

  /**
   * Batch resolve multiple fact values efficiently
   */
  batchFactValues (requests) {
    const promises = requests.map(({ factId, params, path }) =>
      this.factValue(factId, params, path)
    )
    return Promise.all(promises)
  }
}
