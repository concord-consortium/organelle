import rules from './rules'
const { getValue } = rules

/**
 * Shallow merge of props and defaults:
 * properties = {
 *   a: 1,
 *   b: false,
 *   c: {
 *     c1: 0
 *   }
 * }
 *
 * defaultProperties = {
 *   c: {
 *     c2: 1
 *   },
 *   d: true
 * }
 *
 * return = {
 *   a: 1,
 *   b: false,
 *   c: {
 *     c1: 0
 *   } ,
 *   d: true
 * }
 */
let setDefaults = (properties, defaultProperties) => {
  let merged = Object.assign({}, properties)
  for (let key in defaultProperties) {
    if (!merged.hasOwnProperty(key)) {
      merged[key] = defaultProperties[key]
    }
  }
  return merged
}

export default class PropertiesHolder {
  constructor(options) {
    this.props = {}

    let { properties, defaultProperties, calculatedProperties } = options
    properties = setDefaults(properties, defaultProperties)

    for (let prop in properties) {
      this.setProperty(prop, properties[prop])
    }

    this.calcProps = calculatedProperties
  }

  setProperty(prop, value) {
    if (Array.isArray(value)) {
      value = this.getNumber(value)
    }
    this.props[prop] = value
  }

  setProperties(properties) {
    for (let prop in properties) {
      this.setProperty(prop, properties[prop])
    }
  }

  getProperty(prop) {
    return this.props[prop]
  }

  updateCalculatedProperties() {
    // duck-typing, but TODO work out a better system
    let world = this.world ? this.world : this,
        agent = this.world ? this : null

    for (let prop in this.calcProps) {
      this.setProperty(prop, getValue(this.calcProps[prop], world, agent, this))
    }
  }

  getNumber(val, defaultVal) {
    let num
    if (typeof val === "number") {
      return val
    }
    if (Array.isArray(val)) {
      let range = val[1] - val[0],
          floor = val[0]
      return floor + Math.random() * range
    }
    if (typeof val === "string") {
      return this.getProperty(val)
    }
    return defaultVal
  }
}
