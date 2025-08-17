'use strict'

const { Transform } = require('stream')

class RuleEngineTransformSync extends Transform {
  constructor (engine, options = {}) {
    super({ objectMode: true, ...options })
    this.engine = engine
    this.processedCount = 0
    this.startTime = null
  }

  _transform (chunk, encoding, callback) {
    if (this.startTime === null) {
      this.startTime = process.hrtime.bigint()
    }

    try {
      const event = chunk.Body || chunk
      const result = this.engine.run(event)

      this.processedCount++

      this.push({
        originalEvent: event,
        ruleResults: result.events || [],
        triggeredCount: result.events ? result.events.length : 0,
        processedAt: Date.now()
      })

      callback()
    } catch (error) {
      callback(error)
    }
  }

  getStats () {
    const endTime = process.hrtime.bigint()
    const durationNs = this.startTime ? endTime - this.startTime : 0n
    const durationMs = Number(durationNs) / 1000000

    return {
      processedCount: this.processedCount,
      durationMs,
      throughputPerSecond: this.processedCount / (durationMs / 1000)
    }
  }
}

module.exports = {
  RuleEngineTransformSync
}
