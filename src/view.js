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

        if (agent.oldImage) {
          this.canvas.remove(agent.oldImage)
        }
        this.canvas.add(agentImage)
        util.preventInteraction(agentImage)

        if (this.newAgentImageProps) {
          this.setPropertiesOnObject(agentImage,
            this.newAgentImageProps.props, this.newAgentImageProps.isTemporary, this.newAgentImageProps.skip)
        }

        this.position(agentImage, agent.props)
        agent.addingImage = false
        agent.agentImage = agentImage
    });
  }

  position(image,{x, y, size=1}) {
    const imageScale = this.scale * size
    const viewX = ((x - this.world.bounds.left) * this.scale) - (image.width * imageScale/2)
    const viewY = ((y - this.world.bounds.top) * this.scale) - (image.height * imageScale /2)
    image.set({left: viewX, top: viewY})
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

  getModelSvgObjectById(id) {
    return this.getAllViewObjects().find(o => o.id === id)
  }

  /**
   *
   * @param {object} props An object of keys and values, e.g. {opacity: 0.5, fill: "blue"}
   * @param {boolean} isTemporary If true, old value will be stored and can be recovered
   * @param {any} skip One object, an array of objects, or a selector that will be skipped
   */
  setPropertiesOnAllObjects(props, isTemporary, skip, includeNewAgents) {
    const viewObjects = this.getAllViewObjects()
    viewObjects.forEach(o => {
      this.setPropertiesOnObject(o, props, isTemporary, skip)
    })
    if (includeNewAgents) {
      this.newAgentImageProps = {props, isTemporary, skip}
    }
  }

  setPropertiesOnObject(o, props, isTemporary, skip) {
    if (o === skip ||
      (Array.isArray(skip) && skip.includes(o)) ||
      ((skip.selector || skip.species) && util.matches(skip, o, true))) {
        return
    }
    if (isTemporary) {
      if (!o._organelle) o._organelle = {}
      o._organelle.oldProps = {...props}
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
