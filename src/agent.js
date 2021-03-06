import PropertiesHolder from './properties-holder'
import rules from './rules'
import util from './util'
const { runRules, getEntityAndProp, getFactValue } = rules
const two_pi = Math.PI * 2
const half_pi = Math.PI / 2

export default class Agent extends PropertiesHolder {

  constructor(species, world, listener) {
    let properties = species.properties || {},

        defaultProperties = {
          x: 0,
          y: 0,
          size: 1,
          speed: 1,
          direction: 0
        }

    super({ properties, defaultProperties })

    this.species = species
    this.world = world
    this.listener = listener

    this.references = {}
    this.taggedFacts = {}

    // default true for now
    this.dieWhenExitingWorld = species.dieWhenExitingWorld !== undefined ? species.dieWhenExitingWorld : true

    if (species.spawn && species.spawn.on) {
      let {x, y} = this.world.getLocation(species.spawn.on, this.props)

      this.props.x = x
      this.props.y = y
    }

    this.state = species.initialState || "initialization"

    this.stateChangeCount = 0     // updates each time we change state

    // really?
    this.step()
  }

  step() {
    const tasks = runRules(this.world, this)
    for (let task of tasks) {
      this.doTask(task)
    }

    if (this.dieWhenExitingWorld && !this.world.isInWorld(this.props)) {
      this.dead = true
    }

    return
  }

  doTask(task) {
    if (task.debugger) {
      debugger
    }
    if (task.switch_state) {
      if (this.species.rules[task.switch_state]) {
        this.state = task.switch_state
        this.stateChangeCount++
      } else {
        throw Error(`Can't switch state to "${task.switch_state}", requested by ${this.species.name} rules`)
      }
    }
    for (let taskName of Object.keys(task)) {
      if (this["task_"+taskName] && typeof this["task_"+taskName] === "function") {
        let complete = this["task_"+taskName](task[taskName])
        if (complete && task[taskName].finally) {
          this.doTask(task[taskName].finally)
        }
      } else {
        if (taskName !== "debugger" && taskName !== "switch_state") {
          throw Error(`"${taskName}" is not a known agent task, requested by ${this.species.name} rules`)
        }
      }
    }
  }

  task_grow(val) {
    if (val.by) {
      const changeProps = Object.assign({}, val, {prop: "size"})    // rm object spread: {prop: "size", ...val}
      return this.task_change(changeProps)
    } else {
      return this.task_change({prop: "size", by: val})
    }
  }

  task_change(val) {
    const by = this.getNumber(val.by)
    if (typeof val.until === "number") {
      let complete = by > 0 ? this.props[val.prop] >= val.until : this.props[val.prop] <= val.until
      if (!complete) {
        let bounds = by > 0 ? Math.min : Math.max
        this.props[val.prop] = bounds(this.props[val.prop] + by, val.until)
      } else {
        return true
      }
    } else {
      this.props[val.prop] += by
    }
  }

  /**
   * set:
   *   size: 0.5
   *   world.some_boolean: false
   */
  task_set(val) {
    for (let prop of Object.keys(val)) {
      const { entity, prop: propName } = getEntityAndProp(prop, this.world, this);
      const value = getFactValue(val[prop], this.world, this, this)
      entity.setProperty(propName, value)
    }
  }

  task_move_to(val) {
    let key = this.stateChangeCount + JSON.stringify(val),
        x, y
    if (this.references[key]) {
      ({x, y} = this.references[key])
    } else {
      ({x, y} = this.world.getLocation(val, this.props))
      this.references[key] = {x, y}
    }

    let arrived = this.travelTo({x, y})

    if (arrived) {
      delete this.references[key]
    }
    return arrived
  }

  task_follow(val) {
    let key = this.stateChangeCount + JSON.stringify(val),
        speed = this.getNumber(this.props.speed, 1),
        pathInfo, direction, distance, until
    if (this.references[key]) {
      ({pathInfo, direction, distance, until} = this.references[key])
    } else {
      pathInfo = this.world.getPath(val, this.props)

      direction = val.direction === "backward" ? -1 :
                  val.direction === "random" ? (Math.round(Math.random()) - 0.5) * 2 :
                  1
      // if we passed in `at`, use the location returned by `getPath`. Otherwise look at the
      // direction and assume we start at one end
      distance = val.at ? pathInfo.length * pathInfo.percentAlongPath :
                  direction === 1 ? 0 : pathInfo.length
      let untilPerc = this.getNumber(val.until, direction === 1 ? 1 : 0)
      until = pathInfo.length * untilPerc

      this.references[key] = {pathInfo, direction, distance, until}
    }

    distance += (speed * direction)
    this.references[key].distance = distance

    let {x, y} = util.getPointAlongPath(pathInfo.path, distance)

    this.props.x = x
    this.props.y = y

    let arrived = direction === 1 ? distance >= until : distance <= until
    if (arrived) {
      delete this.references[key]
    }

    return arrived
  }

  task_notify(message) {
    const key = this.stateChangeCount + message
    if (this.references[key]) {
      return
    }
    this.references[key] = true
    this.listener.notify(this, message)
  }

  travelTo({x, y}) {
    let dx = x - this.props.x,
        dy = y - this.props.y,
        distSq = (dx * dx) + (dy * dy),
        speed = this.getNumber(this.props.speed, 1),
        speedSq = speed * speed,
        direction = Math.atan2(dy, dx)

    speed = (distSq > speedSq) ? speed : Math.sqrt(distSq)

    this.travel({speed, direction})

    return (this.props.x === x && this.props.y === y)
  }

  /**
   *  returns the next location given a speed and direction, without actually going there.
   */
  nextLoc({speed, direction}) {
    let vx = Math.cos(direction) * speed,
        vy = Math.sin(direction) * speed
    return {
      x: this.props.x + vx,
      y: this.props.y + vy
    }
  }

  travel({speed, direction}) {
    this.setProperties(this.nextLoc({speed, direction}))
  }

  task_set_image_selector(selector) {
    this.props.image_selector = selector
  }

  task_diffuse(val) {
    const key = this.stateChangeCount + JSON.stringify(val)
    let direction, boundingPaths, endTime
    if (this.references[key]) {
      ({direction, boundingPaths, endTime} = this.references[key])
    } else {
      direction = Math.random() * two_pi
      if (val.bounding_paths) {
        boundingPaths = []
        val.bounding_paths.forEach((selector) => boundingPaths = boundingPaths.concat(this.world.findNodes(selector)))
      }
      if (val.for) {
        endTime = this.world.tick + this.getNumber(val.for)
      }
      this.references[key] = {direction, boundingPaths, endTime}
    }
    if (Math.random() < 0.1) {
      direction += (Math.random() * half_pi) - (half_pi/2)
    }

    if (endTime && this.world.tick >= endTime) {
      delete this.references[key]
      return true
    }

    let nextLoc,
        crosses = true,
        maxAttempts = 3
    while (crosses && --maxAttempts) {
      nextLoc = this.nextLoc({speed: this.props.speed, direction})
      let line = {x1: this.props.x, y1: this.props.y, x2: nextLoc.x, y2: nextLoc.y}
      crosses = boundingPaths.some((path) => util.testPathLineIntersection(path, line))
      if (crosses) {
        direction += (Math.random() * Math.PI) - (half_pi)
      }
    }
    if (!crosses) {
      this.references[key].direction = direction
      this.setProperties(nextLoc)
    }
  }

  task_wait(val) {
    let key = this.stateChangeCount + JSON.stringify(val),
        waitTime
    if (val === "forever") return
    if (this.references[key]) {
      waitTime = this.references[key]
    } else {
      let startTime = this.world.tick

      waitTime = {start: startTime, duration: this.getNumber(val.for)}
      this.references[key] =  waitTime
    }
    if (this.world.tick >= (waitTime.start + waitTime.duration)) {
      delete this.references[key]
      return true
    }
  }

  task_die(val) {
    if (val) {
      this.die()
    }
  }

  die() {
    this.dead = true
  }
}
