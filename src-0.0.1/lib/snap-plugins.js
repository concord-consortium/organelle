var Snap = require("snapsvg")

Snap.plugin( function( Snap, Element, Paper, global ) {
    Element.prototype.nativeAttrs = function( attrs ) {
        for (var p in attrs)
            this.node.setAttributeNS(null, p, attrs[p]);
        return this;
    }
});


// Snap improvement functions
// ...should be handled better

window.snapAppend = function(snap, fragment, selector, fromCache) {
  let el = fragment.select(selector)
  snap.append(el)
  if (!fromCache) {
    snapAppendDefs(snap, fragment)
  }
  return el
}

window.snapAppendDefs = function(snap, fragment) {
  let uncheckedNodes = []

  function findDefs(node) {
    let children = node.children
    for (let i = 0; i < children.length; i++) {
      if (children[i].tagName == "defs") {
        return children[i]
      } else {
        uncheckedNodes.push(children[i])
      }
    }
    while(uncheckedNodes.length > 0) {
      let ret = findDefs(uncheckedNodes.pop())
      if (ret) {
        return ret
      }
    }
  }
  let defs = findDefs(fragment.node)

  if (defs) {
    Array.from(defs.children).forEach( d => snap.defs.append(d) )
  }
}

window.snapCache = {}
window.snapLoad = function(path, callback) {
  if (window.snapCache[path]) {
    callback(Snap(window.snapCache[path].node.cloneNode(true)), true)
  } else {
    Snap.load(path, (img) => {
      window.snapCache[path] = Snap(img.node.cloneNode(true))
      callback(img, false)
    })
  }
}
