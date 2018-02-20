import PropertiesHolder from "./properties-holder"
import Agent from "./agent"
import util from './util'

export default class World extends PropertiesHolder {
  constructor(options) {
    super(options)

    this.worldSvgModel = util.parseSVG(options.worldSvgString)

    this.bounds = options.bounds || util.parseViewbox(this.worldSvgModel)
    this.bounds.right = this.bounds.left + this.bounds.width
    this.bounds.bottom = this.bounds.top + this.bounds.height

    const b = this.bounds
    const viewBox = [b.left, b.top, b.width, b.height].join(' ')

    this.worldSvgModel.setAttribute("viewBox", viewBox)

    this.tick = 0
    this.speciesArr = options.species
    this.species = {}
    this.agents = []
    this.deadAgents = []

    for (let kind of this.speciesArr) {
      this.species[kind.name] = kind
    }

    this._agentNotified = this._agentNotified.bind(this)
    this.notify = options.notify

    this._pathCacheIdIndex = 0
    this._cachedPathPoints = {}
  }

  step() {
    this.tick++
    for (let kind of this.speciesArr) {
      let spawnPeriod = this.getValueOrWorldProp(kind.spawn.every)
      if ((kind.spawn.start && this.tick === 1) || (spawnPeriod && this.tick % spawnPeriod === 0)) {
        this.createAgent(kind)
      }
    }

    for (let agent of this.agents) {
      agent.step()
    }

    for (let agent of this.agents) {
      if (agent.dead) {
        // does this make sense? view needs to know which agent images to remove
        this.deadAgents.push(agent)
      }
    }

    this.agents = this.agents.filter( (a) => !a.dead)

    if (this.tick % 10 === 0) {
      this.updateCalculatedProperties()
    }
  }

  createAgent(kind) {
    let agent = new Agent(kind, this, {notify: this._agentNotified})
    this.agents.push(agent)
    return agent
  }

  clearDeadAgents() {
    this.deadAgents = []
  }

  isInWorld({x, y}) {
    return x >= this.bounds.left && x <= this.bounds.right &&
        y >= this.bounds.top && y <= this.bounds.bottom
  }

  _agentNotified(agent, message) {
    const evtName = `${agent.species.name}.notify${typeof message === 'string' ? '.' + message : ''}`
    this.notify(evtName, {agent: agent, message: message})
  }

  getPath(props, {x: agent_x, y: agent_y}) {
    let matchingPaths = this.worldSvgModel.querySelectorAll(props.selector),
        path, initialLocation, percentAlongPath
    if (typeof props.which === "number") {
      path = matchingPaths[props.which]
    } else if (props.which === "random") {
      path = matchingPaths[Math.floor(Math.random() * matchingPaths.length)]
    } else if (props.which === "nearest" || (props.which && props.which.any_of_nearest) || props.within) {
      let numNearest = (props.which && props.which.any_of_nearest) ? props.which.any_of_nearest : 1,
          leastSqDistance = Array(numNearest).fill({dist: Infinity}),
          withinSq = (props.within * props.within) || Infinity

      matchingPaths.forEach( p => {
        let {point, percentAlongPath} = this.getLocationOfNode(p, props.at, {x: agent_x, y: agent_y})
        let dx = agent_x - point.x,
            dy = agent_y - point.y,
            sqDistance = dx * dx + dy * dy
        // bump furthest
        if (sqDistance < withinSq && sqDistance < leastSqDistance[numNearest-1].dist) {
          leastSqDistance[numNearest-1] = {path: p, dist: sqDistance, initialLocation: point, percentAlongPath}
          // re-sort array from nearest to furthest
          leastSqDistance.sort(function(a, b) {
            return a.dist - b.dist
          })
        }
      })

      let selection = leastSqDistance[Math.floor(Math.random() * numNearest)]
      ;({path, initialLocation, percentAlongPath} = selection)
    } else {
      path = matchingPaths[0]
    }
    if (!path) {
      return null
    } else {
      let length = path.getTotalLength ? path.getTotalLength() : 0
      if (!initialLocation) {
        ({point: initialLocation, percentAlongPath} = this.getLocationOfNode(path, props.at, {x: agent_x, y: agent_y}))
      }
      return { path, length, initialLocation, percentAlongPath }
    }
  }

  getLocation(props, {x, y}) {
    let loc = {}
    if (props.selector) {
      loc = this.getPath(props, {x, y}).initialLocation
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

  /**
   * Returns an {x, y} location given an SVG node, and an option definition for a location on that node.
   * Also returns the distance along the SVG node that point represents (for <path> nodes).
   *
   * @param {SVGnode} node An SVG element. If a <circle> or a <rect> is passed in, we will return the center point
   * If a <path> is passed in, we will either return the first point or a point defined by @param at
   * @param {(string|number)} at Defines which point along a <path> we should return. If we pass a number, from
   * 0 to 1, it will return the point at that percentage along the path. If we pass "random" it will return a random
   * point. If we pass "nearest" as well as @param fromPoint, it will return the nearest point to @param fromPoint
   * @param {Object} fromPoint {x, y} location of point to measure @param at "nearest" from
   * @returns {Object} {point: {x, y}, percentAlongPath}
   */
  getLocationOfNode(node, at, fromPoint) {
    if (node.tagName === "circle") {
      return {
        point: {x: node.cx.baseVal.value, y: node.cy.baseVal.value},
        percentAlongPath: 0
      }
    } else if (node.tagName === "rect") {
      const x = node.x.baseVal.value
      const y = node.y.baseVal.value
      const width = node.width.baseVal.value
      const height = node.height.baseVal.value
      return {
        point: {x: x + width / 2, y: y + height / 2},
        percentAlongPath: 0
      }
    } else if (node.tagName === "path") {
      if (at === "nearest") {
        return util.closestPoint(node, fromPoint)
      }
      let percentAlongPath
      if (at === "random") {
        percentAlongPath = Math.random()
      } else if (typeof at !== "number") {
        percentAlongPath = 0
      } else {
        percentAlongPath = at
      }
      let distanceAlong = node.getTotalLength ? node.getTotalLength() * percentAlongPath : 0
      return {
        point: this.getPointAlongPath(node, distanceAlong),
        percentAlongPath
      }
    }
    return {
      point: {x: 0, y: 0},
      percentAlongPath: 0
    }
  }

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
   * @param {SVG Element} path
   * @param {number} dist Optional distance measured in SVG units. Default 0.
   */
  getPointAlongPath(path, dist) {
    if (!path.cacheId) {
      path.cacheId = ++this._pathCacheIdIndex
    }
    // use toFixed so as not to cache dist = 20 and dist = 20.00001 separately
    const cacheStr = path.cacheId + "." + dist.toFixed()
    if (this._cachedPathPoints[cacheStr]) {
      return this._cachedPathPoints[cacheStr]
    }
    let val
    if (path.getPointAtLength) {
      dist = Math.max(0, dist)
      val = path.getPointAtLength(dist)
    } else {
      val = path.getBBox()
    }
    // cache just the x and y, which is a (tiny) bit lighter than the SVGPoint returned above
    const ret = {x: val.x, y: val.y}
    this._cachedPathPoints[cacheStr] = ret
    return ret
  }

  /**
   * Allows primitive values to be optionally defined by world properties.
   *
   * Used in cases where we can only use a world property, not an agent property. E.g. the species
   * spawn period may be a number or a world property, but not an agent property, as it is global
   * and not related to any individual agent.
   *
   * When requesting a property, can pass in either `property_name` or `world.property_name` for
   * clarity.
   *
   * @param {*} val Either a primitive number or boolean, or a string referring to a world property
   * @returns {*} Value of the property
   */
  getValueOrWorldProp(val) {
    if (typeof val !== "string") {
      return val
    }
    let split = val.split(".")
    if (split.length === 1) {
      return this.getProperty(val)
    }
    if (split[0] !== "world"){
      throw Error(`Error getting property ${val} from World`)
    }
    return this.getProperty(split[1])
  }
}
