import Engine from './engine'
import Fact from './fact'
import Rule from './rule'
import Operator from './operator'
import Almanac from './almanac'
import OperatorDecorator from './operator-decorator'

// Import sync variants
import EngineSync from './sync/engine-sync'
import FactSync from './sync/fact-sync'
import RuleSync from './sync/rule-sync'
import AlmanacSync from './sync/almanac-sync'
import ConditionSync from './sync/condition-sync'

// Import optimized variants
import EngineFast from './optimized/engine-fast'
import AlmanacFast from './optimized/almanac-fast'
import EngineUltra from './optimized/engine-ultra'
import AlmanacUltra from './optimized/almanac-ultra'

export {
  Fact,
  Rule,
  Operator,
  Engine,
  Almanac,
  OperatorDecorator,
  // Sync variants
  EngineSync,
  FactSync,
  RuleSync,
  AlmanacSync,
  ConditionSync,
  // Optimized variants
  EngineFast,
  AlmanacFast,
  EngineUltra,
  AlmanacUltra
}

export default function (rules, options) {
  return new Engine(rules, options)
}
