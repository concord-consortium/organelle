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

    this.references = {}

    // default true for now
    this.dieWhenExitingWorld = true

    let [x, y] = [0, 0]
    if (species.spawn.on) {
      ({x, y} = this.world.getLocation(species.spawn.on, this.props))
    }

    this.props.x = x
    this.props.y = y
    this.props.size = 1

    this.state = "initialization"

    this.step()

    this.view = new AgentView(this, this.world.snap)
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
    if (task.debugger) {
      debugger
    }
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
      let complete = val.by > 0 ? this.props[val.prop] >= val.until : this.props[val.prop] <= val.until
      if (!complete) {
        let bounds = val.by > 0 ? Math.min : Math.max
        this.props[val.prop] = bounds(this.props[val.prop] + val.by, val.until)
      } else {
        return true
      }
    } else {
      this.props[val.prop] += val.by
    }
  }

  task_move_to(val) {
    let key = JSON.stringify(val),
        x, y;
    if (this.references[key]) {
      ({x, y} = this.references[key])
    } else {
      ({x, y} = this.world.getLocation(val, this.props))
      this.references[key] = {x, y}
    }

    let arrived = this.travelTo({x, y})

    if (arrived) {
      this.references[key] = null
    }
    return arrived
  }

  task_follow(val) {
    let key = JSON.stringify(val),
        speed = this.getNumber(this.props.speed, 1),
        direction = val.direction === "backward" ? -1 : 1,
        pathInfo;
    if (this.references[key]) {
      pathInfo = this.references[key].pathInfo
    } else {
      pathInfo = this.world.getPath(val, this.props)
      // for now, just assume we're at the ends
      let initialPos = direction === 1 ? 0 : pathInfo.length,
          untilPerc = this.getNumber(val.until, direction === 1 ? 1 : 0),
          until = pathInfo.length * untilPerc

      this.references[key] = {pathInfo: pathInfo, distance: initialPos, until: until}
    }

    this.references[key].distance += (speed * direction)

    let {x, y} = this.world.getPointAlongPath(pathInfo.path, this.references[key].distance)

    this.props.x = x
    this.props.y = y

    let arrived = direction === 1 ? this.references[key].distance >= this.references[key].until : this.references[key].distance <= this.references[key].until
    if (arrived) {
      this.references[key] = null
    }

    return arrived
  }

  travelTo({x, y}) {
    let dx = x - this.props.x,
        dy = y - this.props.y,
        distSq = (dx * dx) + (dy * dy),
        speed = this.getNumber(this.props.speed, 1),
        speedSq = speed * speed,
        direction = Math.atan2(dy, dx);

    speed = (distSq > speedSq) ? speed : Math.sqrt(distSq)

    let vx = Math.cos(direction) * speed,
        vy = Math.sin(direction) * speed

    this.props.x += vx
    this.props.y += vy

    return (this.props.x === x && this.props.y === y)
  }

  task_set_attr(val) {
    // FIXME
    this.view.setAttr(val)
  }

  task_wait(val) {
    let key = JSON.stringify(val),
        waitTime
    if (this.references[key]) {
      waitTime = this.references[key]
    } else {
      let startTime = this.world.tick

      waitTime = {start: startTime, duration: this.getNumber(val.for)}
      this.references[key] =  waitTime
    }
    if (this.world.tick >= (waitTime.start + waitTime.duration)) {
      this.references[key] = null
      return true
    }
  }

  task_die(val) {
    if (val) {
      this.dead = true
    }
  }

  destroy() {
    this.view.destroy()
  }

  // utils, refactor
  getNumber(val, defaultVal) {
    let num
    if (typeof val === "number") {
      num = val
    } else if (Array.isArray(val)) {
      let range = val[1] - val[0],
          floor = val[0]
      num = floor + Math.random() * range
    } else {
      num = defaultVal
    }
    return num
  }
}
