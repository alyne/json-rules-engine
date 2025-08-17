'use strict'

const { Readable, Writable, Transform } = require('stream')

class ArrayReadStream extends Readable {
  constructor (array, options = {}) {
    super({ objectMode: true, ...options })
    this.array = array
    this.index = 0
  }

  _read () {
    if (this.index < this.array.length) {
      this.push(this.array[this.index])
      this.index++
    } else {
      this.push(null)
    }
  }
}

class ArrayWriteStream extends Writable {
  constructor (options = {}) {
    super({ objectMode: true, ...options })
    this.results = []
  }

  _write (chunk, encoding, callback) {
    this.results.push(chunk)
    callback()
  }

  getResults () {
    return this.results
  }
}

class RuleEngineTransform extends Transform {
  constructor (engine, options = {}) {
    super({ objectMode: true, ...options })
    this.engine = engine
    this.processedCount = 0
    this.startTime = null
  }

  async _transform (chunk, encoding, callback) {
    if (this.startTime === null) {
      this.startTime = process.hrtime.bigint()
    }

    try {
      const event = chunk.Body || chunk
      const result = await this.engine.run(event)

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
  ArrayReadStream,
  ArrayWriteStream,
  RuleEngineTransform
}
