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
  ConditionSync
}

export default function (rules, options) {
  return new Engine(rules, options)
}
