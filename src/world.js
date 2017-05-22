var Snap = require("snapsvg")
require("./lib/snap-plugins")
import Agent from "./agent"

module.exports = class World {
  constructor({element, background, species}) {
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

  isInWorld({x, y}) {
    return x >= this.left && x <= this.right &&
        y >= this.top && y <= this.bottom
  }
}
