'use strict'

import EngineSync from './engine-sync'
import RuleSync from './rule-sync'
import FactSync from './fact-sync'
import AlmanacSync from './almanac-sync'
import ConditionSync from './condition-sync'
import Operator from '../operator'
import OperatorDecorator from '../operator-decorator'

/**
 * Basic engine interface
 * @param  {Rule[]} rules - rules to initialize with
 * @param {Object} options - engine options
 * @return {EngineSync} engine instance
 */
function engineSync (rules, options) {
  return new EngineSync(rules, options)
}

export {
  EngineSync,
  RuleSync,
  FactSync,
  AlmanacSync,
  ConditionSync,
  Operator,
  OperatorDecorator,
  engineSync
}

export default engineSync
