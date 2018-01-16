import { fabric } from 'fabric'
import util from './util'

export default class View {
  constructor(world, elId, width, height) {
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

    if (!world) {
      return;
    }

    fabric.loadSVGFromString(world.worldSvgString, (objects, options) => {
      this.background = fabric.util.groupSVGElements(objects, options)

      this.canvas.add(this.background)
      util.preventInteraction(this.background)
      
      const fitWidthScale = width / this.background.width
      const fitHeightScale = height / this.background.height
      this.scale = Math.min(fitWidthScale, fitHeightScale)
      this.background.scale(this.scale)
      
      this.loaded = true
      this.canvas.remove(this.loadingText)
    }); 
  }

  addAgentImage(agent) {
    agent.addingImage = true
    fabric.loadSVGFromString(agent.species.image, (objects, options) => {
      // would like a better way to recover the <g> hierarchy
      // see: https://github.com/kangax/fabric.js/issues/899
      const imageSelector = agent.props.image_selector
      if (imageSelector) {
        objects = objects.filter(o => o.id === imageSelector)
      }
      const agentImage = fabric.util.groupSVGElements(objects, options)
      agentImage.organelle = {}     // container for custom props, to not overwrite fabric props
      agentImage.organelle.imageSelector = imageSelector


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

  render() {
    for (let agent of this.world.agents) {
      if (!agent.addingImage && !agent.agentImage && !agent.dead) {
        this.addAgentImage(agent)
      } else if (agent.agentImage && !agent.dead) {
        this.position(agent.agentImage, agent.props)

        if (agent.props.image_selector !== agent.agentImage.organelle.imageSelector) {
          // re-add image with new selector
          this.canvas.remove(agent.agentImage)
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
