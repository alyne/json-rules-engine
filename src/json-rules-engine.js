import Engine from './engine'
import Fact from './fact'
import Rule from './rule'
import Operator from './operator'
import Almanac from './almanac'
import OperatorDecorator from './operator-decorator'

// Import optimized variants
import EngineFast from './optimized/engine-fast'
import AlmanacFast from './optimized/almanac-fast'

export {
  Fact,
  Rule,
  Operator,
  Engine,
  Almanac,
  OperatorDecorator,
  // Optimized variants
  EngineFast,
  AlmanacFast
}

export default function (rules, options) {
  return new Engine(rules, options)
}
