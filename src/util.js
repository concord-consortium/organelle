module.exports = {
  preventInteraction: function (fabricObj) {
    fabricObj.selectable = false
    fabricObj.hoverCursor = 'default'
  },

  /**
   * @param {string} selector A simplified CSS-style selector. It can match ".objClass",
   *                          "#objId", can have variants separated by commas, and will
   *                          optionally check ancestors.
   * @param {string} species  The name of the species of an agent attached to this image
   * @param {object} fabricObject
   * @param {boolean} checkAncestors Whether to search the ancestor class and id names
   * @returns true or the name of the selector if matched
   */
  matches: function({selector="", species}, fabricObj, checkAncestors) {
    if (selector) {
      const selectorVars = selector.split(",").map(sel => sel.trim())
      for (let selectorVar of selectorVars) {
        if (selectorVar.indexOf('#') === 0) {
          const id = selectorVar.slice(1)
          if (fabricObj.id === id) return selectorVar
          if (checkAncestors && fabricObj._organelle && fabricObj._organelle.ancestors) {
            if (fabricObj._organelle.ancestors.ids.includes(id)) {
              return selectorVar
            }
          }
        } else if (selectorVar.indexOf('.') === 0 && fabricObj._organelle) {
          const clazz = selectorVar.slice(1)
          if (fabricObj._organelle.class.includes[clazz]) return selectorVar
          if (checkAncestors && fabricObj._organelle.ancestors) {
            if (fabricObj._organelle.ancestors.classes.includes(clazz)) {
              return selectorVar
            }
          }
        }
      }
    } else if (species && fabricObj._organelle && fabricObj._organelle.agent) {
      return fabricObj._organelle.agent.species.name === species
    }
    return false
  },

  /**
   * If we parse an SVG file of the form
   *
   * <svg>
   *    <g id="cell" class="cell_class">
   *      <g id="gate" class="gate_class glow">
   *        <path id="gate_part" class="inner_gate shiny" d="..."
   *      </g>
   *    </g>
   * </svg>
   *
   * ...we will only get back one object, corresponding to the #gate_part path, and it will
   * have no class names.
   *
   * This function will get any class name of the object, and also look up through the parent
   * tree of the raw svg objects, and add to a new ancestors attribute on the fabric object all
   * the classes and ids of the parents.
   *
   * It will add this info to an `_organelle` attribute, to avoid possible namespace clashes with
   * future versions of fabricjs.
   *
   * obj = {
   *  id: "gate_part",
   *  ...
   *  _organelle: {
   *    class: ["inner_gate", "shiny"],
   *    ancestors: {
   *      ids: ["gate", "cell"],
   *      classes: ["gate_class", "glow", "cell_class"]
   *    }
   *  }
   * }
   *
   * See: https://github.com/kangax/fabric.js/issues/899
   */
  addAncestorAndClassAttributes: function(fabricObjects, svgObjects) {
    for (let i = 0; i < fabricObjects.length; i++) {
      const obj = fabricObjects[i]
      if (!obj._organelle) obj._organelle = {}

      let svgObj = svgObjects[i]
      obj._organelle.class = svgObj.className.baseVal.split(" ")

      obj._organelle.ancestors = {
        ids: [],
        classes: []
      }

      while (svgObj = svgObj.parentElement) {
        if (svgObj.id) {
          obj._organelle.ancestors.ids.push(svgObj.id)
        }
        if (svgObj.className.baseVal) {
          obj._organelle.ancestors.classes.push(...svgObj.className.baseVal.split(" "))
        }
      }
    }
  },

  /**
   * Extends the basic fabricObject.set method to allow maipulating number values.
   * e.g. setWithMultiples(obj, {opacity: "*0.5"}) will set opacity to half the current value
   */
  setWithMultiples: function(fabricObject, _props) {
    const props = {..._props}
    // update the prop values, but still do one single `set` call, in case that is optimized in fabricjs
    for (let key in props) {
      let changeValue = props[key]
      // if it starts with *, /, +, -
      if (typeof changeValue === "string" && changeValue.match(/^[\*\/\+\-]/)) {
        let value = fabricObject.get(key)
        if (changeValue.startsWith("*")) {
          props[key] = value * parseFloat(changeValue.slice(1))
        } else if (changeValue.startsWith("/")) {
          props[key] = value / parseFloat(changeValue.slice(1))
        } else if (changeValue.startsWith("+")) {
          props[key] = value + parseFloat(changeValue.slice(1))
        } else if (changeValue.startsWith("-")) {
          props[key] = value - parseFloat(changeValue.slice(1))
        }
      }
    }
    fabricObject.set(props)
  }
}