export default class AgentView {
  constructor(agent, world) {
    this.agent = agent

    this.changeQueue = []
    this.lastAttrChange = null
    this.lastScale = 1

    window.snapLoad(agent.species.image, (img, fromCache) => {
      if (!this.agent.dead) {
        this.el = world.append(img, agent.species.selector, fromCache)
        this.render()
      }
    })
  }

  render() {
    if (this.el) {
      let a = this.agent.props,
          bb = this.el.getBBox(),
          matrix = new Snap.Matrix(),
          dSize = a.size / this.lastScale

      matrix.translate((a.x-(bb.w*dSize)/2), (a.y-(bb.h*dSize)/2))
      matrix.scale(a.size)

      this.el.nativeAttrs({transform: matrix})

      this.lastScale = a.size

      while (this.changeQueue.length) {
        this.setAttr(this.changeQueue.shift())
      }
    }
  }

  setAttr({selector, set}) {
    let changeSet = JSON.stringify({selector, set})
    if (changeSet === this.lastAttrChange) {
      return
    }

    if (this.el) {
      this.el.select(selector).attr(set)
      this.lastAttrChange = changeSet
    } else {
      this.changeQueue.push({selector, set})
    }
  }

  destroy() {
    if (this.el) {
      this.el.remove()
    }
  }
}
