import yaml from 'js-yaml'
import 'whatwg-fetch'         // fetch polyfill

import World from './world'
import View from './view'

class Model {
  constructor({modelSvg: modelSvgPath, properties, calculatedProperties, species, container, stepsPerSecond=100, autoplay=true, hotStart=0}) {
    this.timeouts = []
    this.listeners = []
    const {elId, width, height} = container
    this.setSpeed(stepsPerSecond)

    // initialize loading view
    this.view = new View(null, elId, width, height)

    // load model SVG
    const loadModelSvg = new Promise(resolve => {
      fetch(modelSvgPath).then(response => {
        resolve(response.text())
      })
    })

    // load species definitions
    const speciesLoaders = []
    species.forEach(function(kind, i) {
      if (typeof kind === "string") {
        if (kind.indexOf(".yml") > -1) {
          speciesLoaders.push(new Promise(resolve =>
            fetch(kind)
            .then( response => response.text() )
            .then( yml => resolve(yaml.safeLoad(yml)) )
          ))
        } else {
          speciesLoaders.push(new Promise(resolve => resolve(yaml.safeLoad(kind))))
        }
      } else if (typeof kind === "object") {
        speciesLoaders.push(new Promise(resolve => resolve(kind)))
      }
    })

    // collect all loaded species into single arrayof defs, and also preload images
    let speciesDefs
    const loadSpecies = Promise.all(speciesLoaders)
    .then(defs => {
      speciesDefs = defs
      const imagePaths = speciesDefs.map(def => def.image)
      return Promise.all(imagePaths.map(url => fetch(url)))
    })
    .then(speciesImages => Promise.all(speciesImages.map(image => image.text())))
    .then((speciesImageSvgs) => {
      for (let i = 0; i < speciesDefs.length; i++) {
        speciesDefs[i].image = speciesImageSvgs[i]
      }
      return speciesDefs
    })

    // when everything has loaded, initialize the world
    this.creationPromise = Promise.all([loadModelSvg, loadSpecies])
    .then(data => {
      const [worldSvgString, speciesDefs] = data
      this.world = new World({worldSvgString, properties, calculatedProperties, species: speciesDefs})
      
      // autorun some steps before initial render
      for (let i = 0; i < hotStart; i++) {
        this.world.step()
      }

      this.view = new View(this.world, elId, width, height)

      if (autoplay) {
        this.run()
      }


      return this
    })
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
    this.view.render()
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


module.exports = {
  Model: Model,

  createModel(options) {
    const model = new Model(options)
    return model.creationPromise
  }
}
