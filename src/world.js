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

    // const b = this.bounds
    // const viewBox = [b.left, b.top, b.width, b.height].join(' ')

    // this.worldSvgModel.setAttribute("viewBox", viewBox)

    this.tick = 0
    this.species = options.species
    this.agents = []
    this.deadAgents = []



    this.creationTimes = {}

    // refactor this into a spawning helper
    for (let kind of this.species) {
      if (kind.spawn.every) {
        this.creationTimes[kind.name] = {}
        this.creationTimes[kind.name].nextCreation = kind.spawn.every
      } else if (kind.spawn.start) {
        this.creationTimes[kind.name] = {}
        this.creationTimes[kind.name].nextCreation = 0
      }
    }

    this._pathCacheIdIndex = 0
    this._cachedPathPoints = {}
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
    let agent = new Agent(kind, this)
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

  getPath(props, {x: agent_x, y: agent_y}) {
    let matches = this.worldSvgModel.querySelectorAll(props.selector),
        selection
    if (typeof props.which === "number") {
      selection = matches[props.which]
    } else if (props.which === "random") {
      selection = matches[Math.floor(Math.random() * matches.length)]
    } else if (props.which === "nearest" || (props.which && props.which.any_of_nearest) || props.within) {
      let numNearest = (props.which && props.which.any_of_nearest) ? props.which.any_of_nearest : 1,
          leastSqDistance = Array(numNearest).fill({dist: Infinity}),
          withinSq = (props.within * props.within) || Infinity

      matches.forEach( m => {
        let {x, y} = this.getLocationOfNode(m, props.at)
        let dx = agent_x - x,
            dy = agent_y - y,
            sqDistance = dx * dx + dy * dy
        // bump furthest
        if (sqDistance < withinSq && sqDistance < leastSqDistance[numNearest-1].dist) {
          leastSqDistance[numNearest-1] = {path: m, dist: sqDistance}
          // re-sort array from nearest to furthest
          leastSqDistance.sort(function(a, b) {
            return a.dist - b.dist
          })
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
      loc = this.getLocationOfNode(path, props.at)
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

  getLocationOfNode(node, percentageAlongPath) {
    if (node.tagName === "circle") {
      return {x: node.cx.baseVal.value, y: node.cy.baseVal.value}
    } else if (node.tagName === "rect") {
      const x = node.x.baseVal.value
      const y = node.y.baseVal.value
      const width = node.width.baseVal.value
      const height = node.height.baseVal.value
      return {x: x + width / 2, y: y + height / 2}
    } else if (node.tagName === "path") {
      if (percentageAlongPath === "random") {
        percentageAlongPath = Math.random()
      } else if (typeof percentageAlongPath !== "number") {
        percentageAlongPath = 0
      }
      let distanceAlong = (percentageAlongPath && node.getTotalLength) ? node.getTotalLength() * percentageAlongPath : 0
      return this.getPointAlongPath(node, distanceAlong)
    }
    return {x: 0, y: 0}
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
}
