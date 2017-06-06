
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

module.exports = class PropertiesHolder {
  constructor(options) {
    this.props = {}

    let { properties, defaultProperties } = options
    properties = setDefaults(properties, defaultProperties)

    for (let prop in properties) {
      this.setProperty(prop, properties[prop])
    }
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
}
