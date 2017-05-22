import AgentView from "./agent-view";
import runRules from './rules'

export default class Agent {
  /**
   * image       image to load, if any
   * selector    selector in image
   */
  constructor(species, world) {
    this.species = species
    this.props = {}
    this.world = world

    // default true for now
    this.dieWhenExitingWorld = true

    let spawnEl = this.world.snap.select(species.spawn.on)
    if (spawnEl) {
      let relPos = Math.random() * spawnEl.node.getTotalLength(),
          pos = spawnEl.node.getPointAtLength(relPos)

      this.props.x = pos.x
      this.props.y = pos.y
      this.props.size = 1

      this.state = "birth"

      this.step()

      this.view = new AgentView(this, this.world.snap)
    }
  }

  step() {
    const tasks = runRules(this, this.world)
    for (let task of tasks) {
      this.doTask(task)
    }

    if (this.dieWhenExitingWorld && !this.world.isInWorld(this.props)) {
      this.dead = true
    }

    return;
  }

  doTask(task) {
    if (task.set) {
      for (let prop of Object.keys(task.set)) {
        this.props[prop] = task.set[prop]
      }
    }
    if (task.switch_state) {
      this.state = task.switch_state
    }
    for (let taskName of Object.keys(task)) {
      if (this["task_"+taskName] && typeof this["task_"+taskName] === "function") {
        let complete = this["task_"+taskName](task[taskName])
        if (complete && task[taskName].finally) {
          this.doTask(task[taskName].finally)
        }
      }
    }
  }

  task_grow(val) {
    if (val.by) {
      return this.task_change({prop: "size", ...val})
    } else {
      return this.task_change({prop: "size", by: val})
    }
  }

  task_change(val) {
    if (typeof val.until === "number") {
      if (this.props[val.prop] < val.until) {
        this.props[val.prop] = Math.min(this.props[val.prop] + val.by, val.until)
      } else {
        return true
      }
    } else {
      this.props[val.prop] += val.by
    }
  }

  destroy() {
    this.view.destroy()
  }
}
