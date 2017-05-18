var Snap = require("snapsvg")
require("./lib/snap-plugins")
import Agent from "./agent"

module.exports = class World {
  constructor({element, background, species}) {
    this.snap = Snap("#"+element)

    this.tick = 0
    this.species = species
    this.agents = []

    this.creationTimes = {}

    if (background) {
      Snap.load(background, (img) => {
        this.snap.append(img)

        for (let kind of species) {
          if (kind.spawnPeriod) {
            this.creationTimes[kind.name] = {}
            this.creationTimes[kind.name].nextCreation = 0
          }
        }

      });
    }
  }

  step() {
    this.tick++

    for (let kind of this.species) {
      if (this.creationTimes[kind.name] && this.creationTimes[kind.name].nextCreation < this.tick) {
        this.creationTimes[kind.name].nextCreation = this.tick + kind.spawnPeriod
        let agent = new Agent(kind, this.snap)
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
}
