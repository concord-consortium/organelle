export default class AgentView {
  constructor(agent, snap) {
    this.agent = agent

    Snap.load(agent.species.image, (img) => {
      if (!this.agent.dead) {
        this.el = img.select(agent.species.selector)
        snap.append(this.el)
        this.render()
      }
    })
  }

  render() {
    if (this.el) {
      let a = this.agent,
          bb = this.el.getBBox(),
          matrix = new Snap.Matrix()

      matrix.translate((a.x-bb.w/2), (a.y-bb.h/2))
      matrix.scale(a.size)

      this.el.nativeAttrs({transform: matrix})
    }
  }

  destroy() {
    if (this.el) {
      this.el.remove()
    }
  }
}
