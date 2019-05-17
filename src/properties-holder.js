import { getValue } from './rules'

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
    let world = this.constructor.name === "World" ? this : this.world,
        agent = this.constructor.name === "World" ? null : this

    for (let prop in this.calcProps) {
      this.setProperty(prop, getValue(this.calcProps[prop], world, agent, this))
    }
  }
}
