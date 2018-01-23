import { fabric } from 'fabric'
import util from './util'

export default class View {
  constructor(world, elId, width, height, onClick) {
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

    this.agentImages = []

    this.width = width
    this.height = height
    this.onClick = onClick

    this.handleClick = this.handleClick.bind(this)
    this.canvas.on("mouse:up", this.handleClick)

    if (world) {
      this.loadWorldImage()
    }
  }

  handleClick(evt) {
    if (evt.subTargets.length > 0) {
      this.onClick(evt, evt.subTargets[0])
    } else {
      this.onClick(evt, evt.target)
    }
  }

  setWorld(world) {
    this.world = world
    this.loadWorldImage()
  }

  loadWorldImage() {
    fabric.loadSVGFromString(this.world.worldSvgString, (objects, options, svgElements) => {
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

  addAgentImage(agent) {
    agent.addingImage = true
    fabric.loadSVGFromString(agent.species.image, (objects, options, svgElements) => {
      util.addAncestorAndClassAttributes(objects, svgElements)

      const imageSelector = agent.props.image_selector
      if (imageSelector) {
        objects = objects.filter(o => o.id === imageSelector)
      }
      const agentImage = fabric.util.groupSVGElements(objects, options)
      if (!agentImage._organelle) agentImage._organelle = {}
      agentImage._organelle.agent = agent
      agentImage._organelle.imageSelector = imageSelector

      if (agent.oldImage) {
        this.canvas.remove(agent.oldImage)
      }
      this.canvas.add(agentImage)
      util.preventInteraction(agentImage)

      this.position(agentImage, agent.props)
      agent.addingImage = false
      agent.agentImage = agentImage
    });
  }

  position(image,{x, y, size=1}) {
    const imageScale = this.scale * size
    const viewX = (x * this.scale) - (image.width * imageScale/2)
    const viewY = (y * this.scale) - (image.height * imageScale /2)
    image.set({left: viewX, top: viewY})
    image.scale(imageScale)
  }

  getModelSvgObject(id) {
    if (!this.background) {
      return null
    }
    const objects = this.background.getObjects()
    return objects.find(o => o.id === id)
  }

  render() {
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
