'use strict'

import sinon from 'sinon'
import engineSyncFactory, { Operator } from '../../src/sync/index-sync'
import defaultOperators from '../../src/engine-default-operators'

describe('EngineSync', () => {
  let engine
  let sandbox
  before(() => {
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore()
  })
  beforeEach(() => {
    engine = engineSyncFactory()
  })

  it('has methods for managing facts and rules, and running itself', () => {
    expect(engine).to.have.property('addRule')
    expect(engine).to.have.property('removeRule')
    expect(engine).to.have.property('addOperator')
    expect(engine).to.have.property('removeOperator')
    expect(engine).to.have.property('addFact')
    expect(engine).to.have.property('removeFact')
    expect(engine).to.have.property('run')
    expect(engine).to.have.property('stop')
  })

  describe('constructor', () => {
    it('initializes with the default state', () => {
      expect(engine.status).to.equal('READY')
      expect(engine.rules.length).to.equal(0)
      defaultOperators.forEach(op => {
        expect(engine.operators.get(op.name)).to.be.an.instanceof(Operator)
      })
    })

    it('can be initialized with rules', () => {
      const rules = [
        { conditions: { all: [{ fact: 'test', operator: 'equal', value: 1 }] }, event: { type: 'test' } },
        { conditions: { all: [{ fact: 'test', operator: 'equal', value: 2 }] }, event: { type: 'test' } },
        { conditions: { all: [{ fact: 'test', operator: 'equal', value: 3 }] }, event: { type: 'test' } }
      ]
      engine = engineSyncFactory(rules)
      expect(engine.rules.length).to.equal(rules.length)
    })
  })

  describe('basic functionality', () => {
    it('runs synchronously and returns results immediately', () => {
      engine.addRule({
        conditions: {
          all: [{
            fact: 'testFact',
            operator: 'equal',
            value: 'testValue'
          }]
        },
        event: {
          type: 'testEvent',
          params: {
            message: 'Test message'
          }
        }
      })

      const result = engine.run({ testFact: 'testValue' })

      expect(result).to.have.property('events')
      expect(result).to.have.property('results')
      expect(result).to.have.property('failureEvents')
      expect(result).to.have.property('failureResults')
      expect(result.events).to.have.lengthOf(1)
      expect(result.events[0].type).to.equal('testEvent')
      expect(result.events[0].params.message).to.equal('Test message')
    })

    it('handles failing conditions', () => {
      engine.addRule({
        conditions: {
          all: [{
            fact: 'testFact',
            operator: 'equal',
            value: 'expectedValue'
          }]
        },
        event: {
          type: 'testEvent'
        }
      })

      const result = engine.run({ testFact: 'actualValue' })

      expect(result.events).to.have.lengthOf(0)
      expect(result.failureEvents).to.have.lengthOf(1)
    })

    it('handles multiple rules with different priorities', () => {
      engine.addRule({
        priority: 2,
        conditions: {
          all: [{
            fact: 'priority',
            operator: 'equal',
            value: 'high'
          }]
        },
        event: {
          type: 'highPriority'
        }
      })

      engine.addRule({
        priority: 1,
        conditions: {
          all: [{
            fact: 'priority',
            operator: 'equal',
            value: 'high'
          }]
        },
        event: {
          type: 'lowPriority'
        }
      })

      const result = engine.run({ priority: 'high' })

      expect(result.events).to.have.lengthOf(2)
      expect(result.events[0].type).to.equal('highPriority')
      expect(result.events[1].type).to.equal('lowPriority')
    })
  })

  describe('fact management', () => {
    it('adds and uses constant facts', () => {
      engine.addFact('constantFact', 42)
      engine.addRule({
        conditions: {
          all: [{
            fact: 'constantFact',
            operator: 'equal',
            value: 42
          }]
        },
        event: { type: 'success' }
      })

      const result = engine.run({})
      expect(result.events).to.have.lengthOf(1)
    })

    it('adds and uses dynamic facts', () => {
      engine.addFact('dynamicFact', (params, almanac) => {
        return params.multiplier * 2
      })

      engine.addRule({
        conditions: {
          all: [{
            fact: 'dynamicFact',
            operator: 'equal',
            value: 10,
            params: { multiplier: 5 }
          }]
        },
        event: { type: 'success' }
      })

      const result = engine.run({})
      expect(result.events).to.have.lengthOf(1)
    })
  })
})
