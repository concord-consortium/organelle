import World from "./world"

class Model {
  constructor({element, background, properties, species, stepsPerSecond=100, autoplay=true}) {
    this.world = new World({element, background, properties, species})
    this.running = false
    this.setSpeed(stepsPerSecond)
    if (autoplay) {
      this.run();
    }
  }

  setSpeed(stepsPerSecond) {
    this.stepPeriodMs = (1 / stepsPerSecond) * 1000
    // if user had tabbed away for a while, we don't need to try and catch
    // up completely when they return, blocking the model while we do so
    this.maxCatchUpSteps = stepsPerSecond * 10

    if (this.running) {
      // start tracking our time afresh
      this.totalSteps = 0
      this.startTime = Date.now()
    }
  }

  step(steps=1) {
    for (let i=0; i<steps; i++) {
      this.world.step()
    }
    this.world.render()
  }

  run() {
    if (!this.running) {
      this.running = true
      this.totalSteps = 0
      this.startTime = Date.now()

      let keepRunning = () => {
        if (this.running) {
          requestAnimationFrame(keepRunning)
        }

        let now = Date.now(),
            dt = now - this.startTime,
            targetTotalSteps = Math.round(dt / this.stepPeriodMs),
            steps = targetTotalSteps - this.totalSteps

        steps = Math.min(steps, this.maxCatchUpSteps)

        this.step(steps)

        // assume we caught up, even if we only ran maxCatchUpSteps
        this.totalSteps = targetTotalSteps;
      }
      keepRunning()
    }
  }

  stop() {
    this.running = false
  }
}


export default {

  createModel({element, background, properties, species, stepsPerSecond, autoplay}) {
    return new Model({element, background, properties, species, stepsPerSecond, autoplay})
  }

}
