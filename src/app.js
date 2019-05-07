import yaml from "js-yaml"
import World from "./world"

class Model {
  constructor({element, background, properties, calculatedProperties, species, clickHandlers, stepsPerSecond=100, autoplay=true}) {
    this.world = new World({element, background, properties, calculatedProperties, species, clickHandlers})
    this.running = false
    this.setSpeed(stepsPerSecond)
    this.timeouts = []
    this.listeners = []
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
    this.notifyListeners()
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
        this.totalSteps = targetTotalSteps

        for (let i=0; i < this.timeouts.length; i++) {
          if (this.timeouts[i] && this.timeouts[i].step < this.totalSteps) {
            this.timeouts[i].func()
            this.timeouts[i] = null
          }
        }
        if (!this.running) {
          this.totalSteps = 0
        }
      }
      keepRunning()
    }
  }

  stop() {
    this.running = false
  }

  setTimeout(func, delay) {
    let stepCount = delay / this.stepPeriodMs,
        step = this.totalSteps + stepCount
    this.timeouts.push({step, func})
  }

  addListener(listener) {
    this.listeners.push(listener)
  }

  notifyListeners() {
    for (let listener of this.listeners) {
      listener()
    }
  }
}

// fixme
function makeRequest (method, url) {
  return new Promise(function (resolve, reject) {
    var xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.onload = function () {
      if (this.status >= 200 && this.status < 300) {
        resolve(xhr.response);
      } else {
        reject({
          status: this.status,
          statusText: xhr.statusText
        });
      }
    };
    xhr.onerror = function () {
      reject({
        status: this.status,
        statusText: xhr.statusText
      });
    };
    xhr.send();
  });
}


export default {

  createModel(options) {
    let speciesLoaderPromises = [],
        { species } = options

    for (let kind of species) {
      if (typeof kind === "string") {
        yaml.safeLoad(kind);
      }
    }
    species.forEach(function(kind, i) {
      if (typeof kind === "string") {
        if (kind.indexOf(".yml") > -1) {
          speciesLoaderPromises.push(makeRequest('GET', kind)
            .then(function (yml) {
              species[i] = yaml.safeLoad(yml);
            })
          );
        } else {
          species[i] = yaml.safeLoad(kind);
        }
      }
    });

    return Promise.all(speciesLoaderPromises).then( () => {
      return new Model(options)
    });
  }

}
