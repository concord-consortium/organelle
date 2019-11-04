import { fabric } from 'fabric'
// patch fabric.js:

// improve zoomToPoint (see https://github.com/kangax/fabric.js/issues/2446):
fabric.StaticCanvas.prototype.zoomToPoint = function (point, value) {
  // TODO: just change the scale, preserve other transformations
  var before = point;
  this.viewportTransform[0] = value;
  this.viewportTransform[3] = value;
  this.viewportTransform[4] = 0;
  this.viewportTransform[5] = 0;
  this.viewportTransform[4] = (-point.x*value + this.width / 2);
  this.viewportTransform[5] = (-point.y*value + this.height / 2) ;
  this.renderAll();
  for (var i = 0, len = this._objects.length; i < len; i++) {
    this._objects[i].setCoords();
  }
  return this;
}


export default {


  _pathCacheIdIndex: 0,
  _cachedPathPoints: {},

  // seems to be obsolete, as getTotalLength and getPointAtLength no longer work on
  // non-rendered SVG elements
  // parseSVG(svgString) {
  //   let doc
  //   if (typeof DOMParser !== 'undefined') {
  //     var parser = new DOMParser()
  //     doc = parser.parseFromString(svgString, 'text/xml')
  //   } else if (fabric.window.ActiveXObject) {
  //     doc = new ActiveXObject('Microsoft.XMLDOM')
  //     doc.async = 'false'
  //     // IE chokes on DOCTYPE
  //     doc.loadXML(svgString.replace(/<!DOCTYPE[\s\S]*?(\[[\s\S]*\])*?>/i, ''))
  //   }
  //   return doc.documentElement
  // },

  appendHiddenSVG(svgString) {
    const fragment = document.createDocumentFragment();
    const div = document.createElement("div");
    div.innerHTML = svgString;
    const svgEl = div.getElementsByTagName("svg")[0];
    div.style.visibility = "hidden";
    document.body.append(div);
    return svgEl;
  },

  parseViewbox(svgDoc) {
    const vb = svgDoc.viewBox.baseVal
    return {left: vb.x, top: vb.y, width: vb.width, height: vb.height}
  },

  preventInteraction(fabricObj) {
    fabricObj.selectable = false
    fabricObj.hoverCursor = 'default'
  },

  /**
   * Checks to see if an image object matches a query selector. A query selector can either
   * be a CSS-style string or an agent species name.
   *
   * @param {string} selector A simplified CSS-style selector. It can match ".objClass",
   *                          "#objId", can have variants separated by commas, and will
   *                          optionally check ancestors.
   * @param {string} species  The name of the species of an agent attached to this image
   * @param {object} fabricObject
   * @param {boolean} checkAncestors Whether to search the ancestor class and id names
   * @returns true or the name of the selector if matched
   */
  matches({selector="", species}, fabricObj, checkAncestors) {
    if (!fabricObj) {
      return false
    }
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
          if (fabricObj._organelle.class && fabricObj._organelle.class.includes[clazz]) return selectorVar
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
   * Checks to see if an object matches a selector, where the selector may be an object,
   * an array of objects, or a query selector as in util.matches
   *
   * @param {*} query One object, an array of objects, or a selector
   * @param {object} fabricObject
   */
  matchesObjectOrQuery(query, fabricObject) {
    return fabricObject === query ||
      (Array.isArray(query) && query.includes(fabricObject)) ||
      ((query.selector || query.species) && this.matches(query, fabricObject, true))
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
  addAncestorAndClassAttributes(fabricObjects, svgObjects) {
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
  setWithMultiples(fabricObject, _props) {
    const props = Object.assign({}, _props)
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
  },

  // from https://bl.ocks.org/mbostock/8027637
  closestPoint(pathNode, point) {
    var pathLength = this.getLengthOfPath(pathNode),
        precision = 16,
        best,
        bestLength,
        bestDistance = Infinity

    // linear scan for coarse approximation
    for (var scan, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
      if ((scanDistance = distance2(scan = this.getPointAlongPath(pathNode, scanLength))) < bestDistance) {
        best = scan, bestLength = scanLength, bestDistance = scanDistance
      }
    }

    // // binary search for precise estimate
    // precision /= 2;
    // while (precision > 0.5) {
    //   var before,
    //       after,
    //       beforeLength,
    //       afterLength,
    //       beforeDistance,
    //       afterDistance;
    //   if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = distance2(before = pathNode.getPointAtLength(beforeLength))) < bestDistance) {
    //     best = before, bestLength = beforeLength, bestDistance = beforeDistance
    //   } else if ((afterLength = bestLength + precision) <= pathLength && (afterDistance = distance2(after = pathNode.getPointAtLength(afterLength))) < bestDistance) {
    //     best = after, bestLength = afterLength, bestDistance = afterDistance
    //   } else {
    //     precision /= 2
    //   }
    // }

    return {
      point: best,
      percentAlongPath: bestLength/pathLength
    }

    function distance2(p) {
      var dx = p.x - point.x,
          dy = p.y - point.y
      return dx * dx + dy * dy
    }
  },

  /**
   * Caches `pathEl.getTotalLength` as the native SVG method is slow
   *
   * @param {SVGGeometryElement} pathEl
   */
  getLengthOfPath(pathEl) {
    if (pathEl._length) {
      return pathEl._length
    }
    try {
      pathEl._length = pathEl.getTotalLength();
    } catch (e) {
      debugger;
    }

    return pathEl._length
  },

  /**
   * If passed a path, this returns a point on the path at distance dist.
   *
   * If passed another SVG shape, it just returns the x,y location of the bounding box (for now).
   *
   * The native SVG method path.getPointAtLength(dist) is fairly slow. To reduce the time spent
   * on this in a model with a lot of path following, we cache every result we find.
   *
   * In the basic Geniventure Melanocyte model, with about 30 followable paths, this allows a ~10x
   * speed increase, and results in ~14,000 points cached, weighing about 7MB.
   *
   * @param {SVGGeometryElement} path
   * @param {number} dist Optional distance measured in SVG units. Default 0.
   */
  getPointAlongPath(pathEl, dist) {
    if (!pathEl._cacheId) {
      pathEl._cacheId = ++this._pathCacheIdIndex
    }
    // use toFixed so as not to cache dist = 20 and dist = 20.00001 separately
    const cacheStr = pathEl._cacheId + "." + dist.toFixed()
    if (this._cachedPathPoints[cacheStr]) {
      return this._cachedPathPoints[cacheStr]
    }
    let val
    if (pathEl.getPointAtLength) {
      dist = Math.max(0, dist)
      val = pathEl.getPointAtLength(dist)
    } else {
      val = pathEl.getBBox()
    }
    // cache just the x and y, which is a (tiny) bit lighter than the SVGPoint returned above
    const ret = {x: val.x, y: val.y}
    this._cachedPathPoints[cacheStr] = ret
    return ret
  },

  isBetween(a, b1, b2) {
    if ((a >= b1) && (a <= b2)) { return true; }
    if ((a >= b2) && (a <= b1)) { return true; }
    return false;
  },

  /**
   * Tests if two lines intersect.
   *
   * @param {Object} line1 Line formatted as {x1, y1, x2, y2}
   * @param {Object} line1 Line formatted as {x1, y1, x2, y2}
   * @returns {x, y} point of intersection, or false
   */
  testLineLineIntersection(line1, line2) {
    var x1 = line1.x1, x2 = line1.x2, x3 = line2.x1, x4 = line2.x2;
    var y1 = line1.y1, y2 = line1.y2, y3 = line2.y1, y4 = line2.y2;
    var pt_denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    var pt_x_num = (x1*y2 - y1*x2) * (x3 - x4) - (x1 - x2) * (x3*y4 - y3*x4);
    var pt_y_num = (x1*y2 - y1*x2) * (y3 - y4) - (y1 - y2) * (x3*y4 - y3*x4);
    if (pt_denom == 0) {
      // parallel
      return false
    }
    else {
      var pt = {'x': pt_x_num / pt_denom, 'y': pt_y_num / pt_denom};
      if (this.isBetween(pt.x, x1, x2) && this.isBetween(pt.y, y1, y2) && this.isBetween(pt.x, x3, x4) && this.isBetween(pt.y, y3, y4)) { return pt; }
      else {
        // misses
        return false
      }
    }
  },

  /**
   * Tests if a path and a line intersect.
   *
   * @param {SVGPath} pathEl SVG Path
   * @param {Object} line Line formatted as {x1, y1, x2, y2}
   * @returns true if intersects
   */
  testPathLineIntersection(pathEl, line) {
    var n_segments = 40
    var pathLength = this.getLengthOfPath(pathEl)
    for (var i=0; i<n_segments; i++) {
      var pos1 = this.getPointAlongPath(pathEl, pathLength * i / n_segments)
      var pos2 = this.getPointAlongPath(pathEl, pathLength * (i+1) / n_segments)
      var line1 = {x1: pos1.x, x2: pos2.x, y1: pos1.y, y2: pos2.y}
      var pt = this.testLineLineIntersection(line1, line)
      if (pt) {
        // return bool immediately. If ever needed, we could instead add each
        // intersection to an array and pass that back
        return true
      }
    }
    return false
  }
}