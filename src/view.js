import { fabric } from 'fabric'
import util from './util'

export default class View {
  constructor(world, elId, width, height, onClick, onHover) {
    this.world = world
    this.container = document.getElementById(elId)
    if (!this.container) {
      throw new Error(`Cannot find an element with the id: ${elId}`)
    }
    const canvasElId = `${elId}-canvas`
    const canvasEl = document.createElement('canvas')
    canvasEl.setAttribute('id', canvasElId)
    canvasEl.setAttribute('width', width)
    canvasEl.setAttribute('height', height)
    this.container.appendChild(canvasEl)
    this.canvas = new fabric.Canvas(canvasElId);

    this.loadingText = new fabric.Text('loading...', { left: width/2, top: height/2 })
    this.canvas.add(this.loadingText)
    this.loaded = false

    this.width = width
    this.height = height
    this.onClick = onClick
    this.onHover = onHover

    this.handleClick = this.handleClick.bind(this)
    this.handleHover = this.handleHover.bind(this)
    this.canvas.on("mouse:up", this.handleClick)
    this.canvas.on("mouse:move", this.handleHover)

    if (world) {
      this.loadWorldImage()
    }
  }

  handleClick(evt) {
    if (evt.subTargets && evt.subTargets.length > 0) {
      evt.target = evt.subTargets[0]
      this.onClick(evt)
    } else {
      this.onClick(evt)
    }
  }

  handleHover(evt) {
    if (evt.subTargets && evt.subTargets.length > 0) {
      evt.target = evt.subTargets[0]
      this.onHover(evt)
    } else {
      this.onHover(evt)
    }
  }

  setWorld(world) {
    this.world = world
    this.loadWorldImage()
  }

  loadWorldImage() {
    fabric.parseSVGDocument(this.world.worldSvgModel, (objects, options, svgElements) => {
      util.addAncestorAndClassAttributes(objects, svgElements)
      options.subTargetCheck = true
      this.background = fabric.util.groupSVGElements(objects, options)

      this.canvas.add(this.background)
      util.preventInteraction(this.background)

      const fitWidthScale = this.width / this.background.width
      const fitHeightScale = this.height / this.background.height
      this.scale = Math.min(fitWidthScale, fitHeightScale)
      this.background.scale(this.scale)

      this.loaded = true
      this.canvas.remove(this.loadingText)
    });
  }

/**
   * Returns a Promise which resolves to a fabric image object
   *
   * @param {*} imgDef
   */
  _getAgentImage(imgDef, imageSelector) {
    if (imgDef.shape) {
      const shapes = {
        rect: fabric.Rect
      }
      return Promise.resolve(new shapes[imgDef.shape](imgDef.props))
    } else {
      return new Promise((resolve) => {
        fabric.loadSVGFromString(imgDef, (objects, options, svgElements) => {
          util.addAncestorAndClassAttributes(objects, svgElements)

          if (imageSelector) {
            objects = objects.filter(o => o.id === imageSelector)
          }
          resolve(fabric.util.groupSVGElements(objects, options))
        });
      });
    }
  }

  addAgentImage(agent) {
    agent.addingImage = true
    this._getAgentImage(agent.species.image, agent.props.image_selector)
    .then(agentImage => {
      if (!agentImage._organelle) agentImage._organelle = {}
        agentImage._organelle.agent = agent
        agentImage._organelle.imageSelector = agent.props.image_selector
        agentImage._organelle.direction = 0

        if (agent.oldImage) {
          this.canvas.remove(agent.oldImage)
        }
        this.canvas.add(agentImage)
        util.preventInteraction(agentImage)

        if (this.newAgentImageProps) {
          if (!util.matchesObjectOrQuery(this.newAgentImageProps.skip, agentImage)) {
            this.setPropertiesOnObject(agentImage,
              this.newAgentImageProps.props, this.newAgentImageProps.isTemporary)
          }
        }

        agentImage._setOriginToCenter()
        this.position(agentImage, agent.props)
        agent.addingImage = false
        agent.agentImage = agentImage
    });
  }

  position(image,{x, y, size=1, direction=0}) {
    const imageScale = this.scale * size
    const viewX = ((x - this.world.bounds.left) * this.scale)
    const viewY = ((y - this.world.bounds.top) * this.scale)
    image.set({left: viewX, top: viewY})
    if (direction !== image._organelle.direction) {
      image.rotate(direction)
      image._organelle.direction = direction
    }
    image.scale(imageScale)
  }

  getAllViewObjects() {
    const viewObjects = []

    if (this.background) {
      viewObjects.push(...this.background.getObjects())
    }
    const remainingCanvasObjects = this.canvas.getObjects().filter(o => o !== this.background)
    viewObjects.push(...remainingCanvasObjects)
    return viewObjects
  }

  /**
   * Returns the first view object with the given id
   *
   * @param {string} id
   */
  getModelSvgObjectById(id) {
    return this.getAllViewObjects().find(o => o.id === id)
  }

  /**
   * Returns all objects that match the query selection, as defined by util.js:matches
   *
   * @param {string} query CSS-style selector: ".classExample", "#idExample", ".option1, .option2"
   * @param {*} checkAncestors Whether to check ids/classnames of parent objects
   */
  querySelectorAll(query, checkAncestors) {
    const viewObjects = this.getAllViewObjects()
    return viewObjects.filter( o => util.matches({selector: query}, o, checkAncestors))
  }

  setPropertiesOnObjectsByQuery(query, props, isTemporary, checkAncestors, includeNewAgents) {
    const queryObjects = this.querySelectorAll(query, checkAncestors)
    queryObjects.forEach(o => {
      this.setPropertiesOnObject(o, props, isTemporary)
    })
    if (includeNewAgents) {
      this.newAgentImageProps = {props, isTemporary, skip}
    }
  }

  /**
   *
   * @param {object} props An object of keys and values, e.g. {opacity: 0.5, fill: "blue"}
   * @param {boolean} isTemporary If true, old value will be stored and can be recovered
   * @param {any} skip One object, an array of objects, or a selector that will be skipped
   */
  setPropertiesOnAllObjects(props, isTemporary, skip, includeNewAgents) {
    let queryObjects = this.getAllViewObjects()
    if (skip) {
      queryObjects = queryObjects.filter( o => !util.matchesObjectOrQuery(skip, o) )
    }
    queryObjects.forEach(o => {
      this.setPropertiesOnObject(o, props, isTemporary)
    })
    if (includeNewAgents) {
      this.newAgentImageProps = {props, isTemporary, skip}
    }
  }

  setPropertiesOnObject(o, props, isTemporary) {
    if (isTemporary) {
      if (!o._organelle) o._organelle = {}
      o._organelle.oldProps = Object.assign({}, props)
      for (let key in props) {
        o._organelle.oldProps[key] = o.get(key)
      }
    }
    util.setWithMultiples(o, props)
  }

  /**
   * Reverts the effects of setPropertiesOnAllObjects
   */
  resetPropertiesOnAllObjects() {
    const viewObjects = this.getAllViewObjects()
    viewObjects.forEach(o => {
      if (o._organelle && o._organelle.oldProps) {
        o.set(o._organelle.oldProps)
        delete o._organelle.oldProps
      }
    })
    delete this.newAgentImageProps
  }

  hide(query, checkAncestors) {
    this.setPropertiesOnObjectsByQuery(query, {visible: false}, false, checkAncestors, false)
  }

  show(query, checkAncestors) {
    this.setPropertiesOnObjectsByQuery(query, {visible: true}, false, checkAncestors, false)
  }

  get zoom() {
    return this.canvas.getZoom()
  }

  set zoom(z) {
    const {x, y} = this.zoomCenter
    this.canvas.zoomToPoint(new fabric.Point(x, y), z)
  }

  get center() {
    const center = this.canvas.getCenter()
    return {x: center.left, y: center.top}
  }

  get zoomCenter() {
    if (!this._zoomCenter) {
      return this.center
    }
    return this._zoomCenter
  }

  set zoomCenter(c) {
    this._zoomCenter = c
  }

  render() {
    if (!this.loaded) return

    for (let agent of this.world.agents) {
      if (!agent.addingImage && !agent.agentImage && !agent.dead) {
        this.addAgentImage(agent)
      } else if (agent.agentImage && !agent.dead) {
        this.position(agent.agentImage, agent.props)

        if (agent.props.image_selector !== agent.agentImage._organelle.imageSelector) {
          // agent's rules have changed the selector
          // we don't delete the old image right away, or we'll get flashing. Instead,
          // store old image and delete it after the async add-image operation
          agent.oldImage = agent.agentImage
          delete agent.agentImage
          // re-add image with new selector
          this.addAgentImage(agent)
        }
      }
    }

    for (let agent of this.world.deadAgents) {
      this.canvas.remove(agent.agentImage)
      this.world.clearDeadAgents()
    }

    this.canvas.renderAll()
  }
}
