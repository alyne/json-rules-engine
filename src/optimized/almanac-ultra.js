'use strict'

import Fact from '../fact'
import { debug, debugEnabled } from './debug-fast'
import { isObject, isFactReference } from './perf-utils'

/**
 * Ultra-optimized Almanac with maximum performance enhancements
 */
export default class AlmanacUltra {
  constructor (options = {}) {
    this.factMap = options.facts || new Map()
    this.runtimeFactMap = new Map()

    // Separate caches for sync vs async facts to avoid Promise wrapping overhead
    this.factResultsCache = new Map() // { cacheKey: actualValue } - no Promise wrapping
    this.factPromiseCache = new Map() // { cacheKey: Promise } - only for truly async facts

    // Pre-compiled JSONPath cache
    this.pathCache = new Map()

    this.allowUndefinedFacts = options.allowUndefinedFacts
    this.pathResolver = options.pathResolver
    this.events = []
  }

  _setFactValue (fact, params, value) {
    // Optimized cache key generation
    let cacheKey
    if (params && Object.keys(params).length > 0) {
      cacheKey = fact.id + JSON.stringify(params)
    } else {
      cacheKey = fact.id
    }

    // Cache actual values, not Promises, for better performance
    this.factResultsCache.set(cacheKey, value)

    if (fact.options.cache === false) {
      // Remove from cache immediately if caching disabled
      this.factResultsCache.delete(cacheKey)
      this.factPromiseCache.delete(cacheKey)
    }

    return Promise.resolve(value)
  }

  _addConstantFact (fact) {
    this.factMap.set(fact.id, fact)
    return this
  }

  addFact (factOrId, valueOrMethod, options) {
    let factId, fact
    if (factOrId instanceof Fact) {
      factId = factOrId.id
      fact = factOrId
    } else {
      factId = factOrId
      fact = new Fact(factId, valueOrMethod, options)
    }

    if (debugEnabled) {
      debug('almanac::addFact', { id: factId })
    }
    return this._addConstantFact(fact)
  }

  addRuntimeFact (factId, factValueOrMethod) {
    let fact
    if (factValueOrMethod instanceof Fact) {
      fact = factValueOrMethod
    } else {
      fact = new Fact(factId, factValueOrMethod)
    }

    if (debugEnabled) {
      debug('almanac::addRuntimeFact', { id: factId })
    }
    this.runtimeFactMap.set(factId, fact)
    return this
  }

  _getFact (factId) {
    return this.runtimeFactMap.get(factId) || this.factMap.get(factId)
  }

  /**
   * Ultra-optimized fact value resolution with smart caching
   */
  factValue (factId, params, path) {
    const fact = this._getFact(factId)
    if (!fact) {
      if (this.allowUndefinedFacts) {
        return Promise.resolve(undefined)
      }
      return Promise.reject(new Error(`Undefined fact: ${factId}`))
    }

    // Optimized cache key - avoid JSON.stringify when possible
    let cacheKey
    if (params && Object.keys(params).length > 0) {
      cacheKey = factId + JSON.stringify(params)
    } else {
      cacheKey = factId
    }

    // Check sync cache first (fastest path)
    if (this.factResultsCache.has(cacheKey)) {
      if (debugEnabled) {
        debug('almanac::factValue cache hit for fact', { id: factId })
      }
      const cachedValue = this.factResultsCache.get(cacheKey)
      return this._applyPath(cachedValue, path)
    }

    // Check if we have a pending Promise for this fact
    if (this.factPromiseCache.has(cacheKey)) {
      return this.factPromiseCache.get(cacheKey).then(value => this._applyPath(value, path))
    }

    if (debugEnabled) {
      debug('almanac::factValue cache miss, calculating', { id: factId })
    }

    // Determine if fact is constant or dynamic
    if (fact.isConstant()) {
      // Sync path - cache immediately and return
      this.factResultsCache.set(cacheKey, fact.value)
      return this._applyPath(fact.value, path)
    }

    // Dynamic fact path - create and cache Promise
    const promise = Promise.resolve(fact.calculate(params, this))
      .then(value => {
        // Move from Promise cache to value cache
        this.factPromiseCache.delete(cacheKey)
        this.factResultsCache.set(cacheKey, value)
        return value
      })

    this.factPromiseCache.set(cacheKey, promise)
    return promise.then(value => this._applyPath(value, path))
  }

  /**
   * Ultra-optimized path application with pre-compiled JSONPath
   */
  _applyPath (factValue, path) {
    if (!path || !isObject(factValue)) {
      return Promise.resolve(factValue)
    }

    // Use custom path resolver if available
    if (this.pathResolver) {
      const pathValue = this.pathResolver(factValue, path)
      if (debugEnabled) {
        debug('condition::evaluate extracting object', { property: path, received: pathValue })
      }
      return Promise.resolve(pathValue)
    }

    // Fast JSONPath with caching
    let compiledPath = this.pathCache.get(path)
    if (!compiledPath) {
      const JSONPath = require('jsonpath-plus').JSONPath
      compiledPath = JSONPath.toPathArray(path)
      this.pathCache.set(path, compiledPath)
    }

    try {
      const pathValue = this._fastJSONPath(factValue, compiledPath)
      if (debugEnabled) {
        debug('condition::evaluate extracting object', { property: path, received: pathValue })
      }
      return Promise.resolve(pathValue)
    } catch (err) {
      if (debugEnabled) {
        debug('condition::evaluate could not compute object path of non-object', { path, factValue, type: typeof factValue })
      }
      return Promise.resolve(undefined)
    }
  }

  /**
   * Fast JSONPath implementation for common cases
   */
  _fastJSONPath (obj, pathArray) {
    let current = obj
    const pathLength = pathArray.length

    for (let i = 0; i < pathLength; i++) {
      if (current == null) return undefined
      current = current[pathArray[i]]
    }

    return current
  }

  /**
   * Ultra-optimized value resolution
   */
  getValue (value) {
    if (!isFactReference(value)) {
      return Promise.resolve(value)
    }
    return this.factValue(value.fact, value.params, value.path)
  }

  getEvent (eventName) {
    return this.events.filter(event => {
      if (eventName) return event.type === eventName
      return true
    })
  }

  addEvent (event, outcome = 'success') {
    this.events.push({ ...event, outcome })
    return this
  }
}
