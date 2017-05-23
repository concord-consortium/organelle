var Snap = require("snapsvg")
require("./lib/snap-plugins")
import Agent from "./agent"

module.exports = class World {
  constructor({element, background, properties, species}) {
    this.snap = Snap("#"+element)

    let vb = this.snap.node.viewBox.baseVal
    this.left   = vb.x
    this.top    = vb.y
    this.right  = vb.x + vb.width
    this.bottom = vb.y + vb.height

    this.tick = 0
    this.species = species
    this.agents = []

    this.props = {}

    for (let prop in properties) {
      this.setProperty(prop, properties[prop])
    }

    this.creationTimes = {}

    if (background) {
      Snap.load(background, (img) => {
        this.snap.append(img)

        // refactor this into a spawning helper
        for (let kind of species) {
          if (kind.spawn.every) {
            this.creationTimes[kind.name] = {}
            this.creationTimes[kind.name].nextCreation = kind.spawn.every
          }
        }

      });
    }
  }

  step() {
    this.tick++

    for (let kind of this.species) {
      if (this.creationTimes[kind.name] && this.creationTimes[kind.name].nextCreation < this.tick) {
        this.creationTimes[kind.name].nextCreation = this.tick + kind.spawn.every
        let agent = new Agent(kind, this)
        this.agents.push(agent)
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

    this.agents = this.agents.filter( (a) => !a.dead)
  }

  render() {
    for (let agent of this.agents) {
      agent.view.render()
    }
  }

  setProperty(prop, value) {
    this.props[prop] = value
  }

  getProperty(prop) {
    return this.props[prop]
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
    } else if (props.which === "nearest") {
      let leastSqDistance = Infinity
      matches.forEach( m => {
        let {x, y} = this.getPercentAlongPath(m.node, props.at)
        let dx = agent_x - x,
            dy = agent_y - y,
            sqDistance = dx * dx + dy * dy
        if (sqDistance < leastSqDistance) {
          leastSqDistance = sqDistance
          selection = m
        }
      })
    } else {
      selection = matches[0]
    }
    return selection
  }

  getLocation(props, {x, y}) {
    let loc = {}
    if (props.selector) {
      let path = this.getPath(props, {x, y})
      loc = this.getPercentAlongPath(path.node, props.at)
    }
    if (typeof props.x === "number") {
      loc.x = props.x
    }
    if (typeof props.y === "number") {
      loc.y = props.y
    }
    return loc
  }

  getPercentAlongPath(path, perc) {
    if (perc === "random") {
      perc = Math.random()
    } else if (typeof perc !== "number") {
      perc = 0
    }
    let distanceAlong = perc ? path.getTotalLength() * perc : 0
    return path.getPointAtLength(distanceAlong)
  }

  getPointAlongPath(path, dist) {
    let arrived = dist >= path.getTotalLength()
    return {...path.getPointAtLength(dist), arrived}
  }
}
