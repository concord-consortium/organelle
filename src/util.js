module.exports = {
  preventInteraction: function (fabricObj) {
    fabricObj.selectable = false
    fabricObj.hoverCursor = 'default'
  },

  matches: function({selector="", species}, fabricObj, checkAncestors) {
    if (selector.indexOf('#') === 0) {
      const id = selector.slice(1)
      if (fabricObj.id === id) return true
      if (checkAncestors && fabricObj._organelle && fabricObj._organelle.ancestors) {
        return fabricObj._organelle.ancestors.ids.includes(id)
      }
    } else if (selector.indexOf('.') === 0 && fabricObj._organelle) {
      const clazz = selector.slice(1)
      if (fabricObj._organelle.class.includes[clazz]) return true
      if (checkAncestors && fabricObj._organelle.ancestors) {
        return fabricObj._organelle.ancestors.classes.includes(clazz)
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
  }
}