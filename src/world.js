var Snap = require("snapsvg")
require("./lib/snap-plugins")
import PropertiesHolder from "./properties-holder"
import Agent from "./agent"

module.exports = class World extends PropertiesHolder {
  constructor(options) {
    super(options)

    let {element, background, species, clickHandlers} = options

    this.snap = Snap("#"+element)

    let vb = this.snap.node.viewBox.baseVal
    this.left   = vb.x
    this.top    = vb.y
    this.right  = vb.x + vb.width
    this.bottom = vb.y + vb.height

    this.tick = 0
    this.species = species
    this.agents = []



    this.creationTimes = {}

    if (background && background.file) {
      Snap.load(background.file, (img) => {
        window.snapAppend(this.snap, img, background.selector)

        // refactor this into a spawning helper
        for (let kind of species) {
          if (kind.spawn.every) {
            this.creationTimes[kind.name] = {}
            this.creationTimes[kind.name].nextCreation = kind.spawn.every
          } else if (kind.spawn.start) {
            this.creationTimes[kind.name] = {}
            this.creationTimes[kind.name].nextCreation = 0
          }
        }

        for (let handler of clickHandlers) {
          this.snap.selectAll(handler.selector).forEach( (sel) => {sel.click( () => {
            handler.action(Snap, this.snap, sel)
          })})
        }

        for (let i=0; i<1500; i++) {
          this.step()
        }
      });
    }
  }

  step() {
    this.tick++

    for (let kind of this.species) {
      if (this.creationTimes[kind.name] && this.creationTimes[kind.name].nextCreation < this.tick) {
        this.creationTimes[kind.name].nextCreation = this.tick + kind.spawn.every
        this.createAgent(kind)
      }
    }

    for (let agent of this.agents) {
      agent.step()
    }

    for (let agent of this.agents) {
      if (agent.dead) {
        agent.destroy()
      }
    }

    if (this.tick % 10 === 0) {
      this.updateCalculatedProperties()
    }

    this.agents = this.agents.filter( (a) => !a.dead)
  }

  render() {
    for (let agent of this.agents) {
      agent.view.render()
    }
  }

  createAgent(kind) {
    let agent = new Agent(kind, this)
    this.agents.push(agent)
    return agent
  }

  append(img, selector, fromCache) {
    return window.snapAppend(this.snap, img, selector, fromCache)
  }

  isInWorld({x, y}) {
    return x >= this.left && x <= this.right &&
        y >= this.top && y <= this.bottom
  }

  getPath(props, {x: agent_x, y: agent_y}) {
    let matches = this.snap.selectAll(props.selector),
        selection;
    if (props.which === "random") {
      selection = matches[Math.floor(Math.random() * matches.length)]
    } else if (props.which === "nearest" || (props.which && props.which.any_of_nearest) || props.within) {
      let numNearest = (props.which && props.which.any_of_nearest) ? props.which.any_of_nearest : 1,
          leastSqDistance = Array(numNearest).fill({dist: Infinity}),
          withinSq = (props.within * props.within) || Infinity

      matches.forEach( m => {
        let {x, y} = this.getPercentAlongPath(m.node, props.at)
        let dx = agent_x - x,
            dy = agent_y - y,
            sqDistance = dx * dx + dy * dy
        // bump furthest
        if (sqDistance < withinSq && sqDistance < leastSqDistance[numNearest-1].dist) {
          leastSqDistance[numNearest-1] = {path: m, dist: sqDistance}
          // re-sort array from nearest to furthest
          leastSqDistance.sort(function(a, b) {
            return a.dist - b.dist;
          });
        }
      })
      selection = leastSqDistance[Math.floor(Math.random() * numNearest)].path
    } else {
      selection = matches[0]
    }
    if (!selection) {
      return null
    } else {
      let length = selection.getTotalLength ? selection.getTotalLength() : 0
      return { path: selection, length: length }
    }
  }

  getLocation(props, {x, y}) {
    let loc = {}
    if (props.selector) {
      let path = this.getPath(props, {x, y}).path
      loc = this.getPercentAlongPath(path.node, props.at)
    }
    if (typeof props.x === "number") {
      loc.x = props.x
    }
    if (typeof props.y === "number") {
      loc.y = props.y
    }
    if (props.random_offset) {
      loc.x += (Math.random() * (props.random_offset * 2)) - props.random_offset
      loc.y += (Math.random() * (props.random_offset * 2)) - props.random_offset
    }
    return loc
  }

  getPercentAlongPath(path, perc) {
    if (perc === "random") {
      perc = Math.random()
    } else if (typeof perc !== "number") {
      perc = 0
    }
    let distanceAlong = (perc && path.getTotalLength) ? path.getTotalLength() * perc : 0
    return this.getPointAlongPath(path, distanceAlong)
  }

  getPointAlongPath(path, dist) {
    if (path.getPointAtLength) {
      dist = Math.max(0, dist)
      return path.getPointAtLength(dist)
    } else {
      return path.getBBox()
    }
  }
}
