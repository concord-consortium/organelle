import AgentView from "./agent-view";

export default class Agent {
  /**
   * image       image to load, if any
   * selector    selector in image
   */
  constructor(species, snap) {
    this.species = species
    this.snap = snap

    let spawnEl = snap.select(species.spawnElement)
    if (spawnEl) {
      let relPos = Math.random() * spawnEl.node.getTotalLength(),
          pos = spawnEl.node.getPointAtLength(relPos)

      this.x = pos.x
      this.y = pos.y

      this.size = 0.1
      this.speed = species.speed
      this.speedSq = this.speed * this.speed

      this.state = "growing"

      this.view = new AgentView(this, snap)
    }

  }

  step() {
    if (this.size < 1 && this.state == "growing") {
      this.size += 0.01
    } else {
      if (this.species.follow) {
        if (!this.destination) {
          let paths = this.snap.selectAll("#microtubules_x5F_grouped path")
          if (paths && paths.length) {
            this.path = paths[Math.floor(Math.random() * paths.length)]
            this.destination = this.path.node.getPointAtLength(0)
            this.state = "finding"
          }
        }
        if (this.state == "finding") {
          let dx = this.destination.x - this.x,
              dy = this.destination.y - this.y,
              distSq = (dx * dx) + (dy * dy)

          this.direction = Math.atan2(dy, dx)
          let speed = (distSq > this.speedSq) ? (this.speed) : Math.sqrt(distSq)

          if (speed == 0) {
            this.state = "following"
            this.distanceAlongLength = 0
          }
          let vx = Math.cos(this.direction) * speed,
              vy = Math.sin(this.direction) * speed
          this.x += vx
          this.y += vy
        }
        if (this.state == "following") {
          this.destination = this.path.node.getPointAtLength(this.distanceAlongLength + this.speed);
          this.x = this.destination.x
          this.y = this.destination.y
          this.distanceAlongLength += this.speed

          if (this.distanceAlongLength > this.path.node.getTotalLength()) {
            this.state = "dying"
          }
        }
        if (this.state == "dying") {
          this.size -= 0.05
          if (this.size <= 0.05) {
            this.dead = true;
          }
        }
      }
    }
  }

  destroy() {
    this.view.destroy()
  }
}
