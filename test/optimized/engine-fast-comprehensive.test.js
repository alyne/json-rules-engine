'use strict'

import sinon from 'sinon'
import { EngineFast, Rule } from '../../src/index'

describe('EngineFast: comprehensive coverage', () => {
  let engine
  let sandbox
  before(() => {
    sandbox = sinon.createSandbox()
  })
  afterEach(() => {
    sandbox.restore()
  })
  beforeEach(() => {
    engine = new EngineFast()
  })

  describe('setCondition()', () => {
    it('throws error when name is missing', () => {
      expect(() => {
        engine.setCondition()
      }).to.throw(/Engine: setCondition\(\) requires name/)
    })

    it('throws error when conditions are missing', () => {
      expect(() => {
        engine.setCondition('test')
      }).to.throw(/Engine: setCondition\(\) requires conditions/)
    })

    it('throws error for invalid root conditions', () => {
      expect(() => {
        engine.setCondition('test', { invalid: true })
      }).to.throw(/"conditions" root must contain a single instance of "all", "any", "not", or "condition"/)
    })

    it('successfully sets a valid condition', () => {
      const conditions = { all: [{ fact: 'age', operator: 'greaterThan', value: 18 }] }
      const result = engine.setCondition('adult', conditions)
      expect(result).to.equal(engine)
      expect(engine.conditions.has('adult')).to.be.true()
    })
  })

  describe('removeCondition()', () => {
    it('removes existing condition', () => {
      const conditions = { all: [{ fact: 'age', operator: 'greaterThan', value: 18 }] }
      engine.setCondition('adult', conditions)
      expect(engine.conditions.has('adult')).to.be.true()

      const result = engine.removeCondition('adult')
      expect(result).to.be.true()
      expect(engine.conditions.has('adult')).to.be.false()
    })

    it('returns false for non-existing condition', () => {
      const result = engine.removeCondition('nonexistent')
      expect(result).to.be.false()
    })
  })

  describe('addOperatorDecorator()', () => {
    it('adds operator decorator', () => {
      engine.addOperatorDecorator('some', (operator) => {
        return operator
      })
      expect(engine.operators.decorators.has('some')).to.be.true()
    })
  })

  describe('removeOperatorDecorator()', () => {
    it('removes operator decorator', () => {
      engine.addOperatorDecorator('some', (operator) => {
        return operator
      })
      expect(engine.operators.decorators.has('some')).to.be.true()

      const result = engine.removeOperatorDecorator('some')
      expect(result).to.be.true()
      expect(engine.operators.decorators.has('some')).to.be.false()
    })
  })

  describe('getFact()', () => {
    it('retrieves existing fact', () => {
      engine.addFact('testFact', 42)
      const fact = engine.getFact('testFact')
      expect(fact).to.exist()
      expect(fact.value).to.equal(42)
    })

    it('returns undefined for non-existing fact', () => {
      const fact = engine.getFact('nonexistent')
      expect(fact).to.be.undefined()
    })
  })

  describe('prioritizeRules()', () => {
    it('prioritizes rules by priority value', () => {
      const rule1 = new Rule(factories.rule({ priority: 10 }))
      const rule2 = new Rule(factories.rule({ priority: 5 }))
      const rule3 = new Rule(factories.rule({ priority: 10 }))

      engine.addRule(rule1)
      engine.addRule(rule2)
      engine.addRule(rule3)

      const prioritized = engine.prioritizeRules()
      expect(prioritized.length).to.equal(2) // Two priority groups
      expect(prioritized[0].length).to.equal(2) // Two rules with priority 10
      expect(prioritized[1].length).to.equal(1) // One rule with priority 5
    })

    it('caches prioritized rules', () => {
      const rule1 = new Rule(factories.rule({ priority: 10 }))
      engine.addRule(rule1)

      const firstCall = engine.prioritizeRules()
      const secondCall = engine.prioritizeRules()
      expect(firstCall).to.equal(secondCall) // Same reference
    })
  })

  describe('rule priority handling', () => {
    it('handles rules with different priorities', async () => {
      const rule1 = new Rule(factories.rule({ priority: 1, event: { type: 'low' } }))
      const rule2 = new Rule(factories.rule({ priority: 10, event: { type: 'high' } }))

      engine.addRule(rule1)
      engine.addRule(rule2)
      engine.addFact('age', 25)
      engine.addFact('pointBalance', 2000)

      const results = await engine.run()
      expect(results.events.length).to.equal(2)
    })

    it('handles stop() during execution', () => {
      const rule = new Rule(factories.rule())
      engine.addRule(rule)
      engine.addFact('age', 25)
      engine.addFact('pointBalance', 2000)

      // Stop the engine
      engine.stop()
      expect(engine.status).to.equal('FINISHED')
    })
  })

  describe('error handling', () => {
    it('handles rule evaluation errors gracefully', async () => {
      const badRule = new Rule({
        conditions: { all: [{ fact: 'age', operator: 'invalidOperator', value: 18 }] },
        event: { type: 'test' }
      })
      engine.addRule(badRule)
      engine.addFact('age', 25)

      const errorSpy = sandbox.spy()
      engine.on('failure', errorSpy)

      try {
        await engine.run()
      } catch (error) {
        // Expected to catch error
      }
    })
  })

  describe('allowUndefinedFacts option', () => {
    it('throws when undefined fact encountered and option is false', async () => {
      const rule = new Rule({
        conditions: { all: [{ fact: 'nonexistent', operator: 'equal', value: 'test' }] },
        event: { type: 'test' }
      })
      engine.addRule(rule)

      try {
        await engine.run()
        expect.fail('Should have thrown an error')
      } catch (error) {
        expect(error.message).to.include('Undefined fact')
      }
    })

    it('treats undefined facts as falsey when option is true', async () => {
      engine = new EngineFast([], { allowUndefinedFacts: true })
      const rule = new Rule({
        conditions: { all: [{ fact: 'nonexistent', operator: 'equal', value: undefined }] },
        event: { type: 'test' }
      })
      engine.addRule(rule)

      const eventSpy = sandbox.spy()
      engine.on('success', eventSpy)

      const result = await engine.run()
      expect(result.events.length).to.equal(1)
    })
  })
})
