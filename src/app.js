import yaml from 'js-yaml'
import 'whatwg-fetch'         // fetch polyfill

import World from './world'
import View from './view'
import util from './util'

const events = {
  MODEL_STEP: "model.step",
  VIEW_CLICK: "view.click",
  VIEW_HOVER: "view.hover",
  VIEW_HOVER_ENTER: "view.hover.enter",
  VIEW_HOVER_EXIT: "view.hover.exit"
}

/**
 * Returns a function that can be passed a url to an asset, or the asset itself.
 * If passed a url, it `fetch()`es it. If passed anything else, it returns an object that can
 * respond to the same text() function to return itself.
 *
 * @param {string} extension The extension to look for to see if it's a url. Accepts regex.
 * @param {*} maybeUrl A url to an asset or a raw asset
 */
const maybeFetch = (extension) => (maybeUrl) => {
  if (typeof maybeUrl === 'string' && maybeUrl.match(`.${extension}$`))
    return fetch(maybeUrl)
  return {
    text() { return maybeUrl }
  }
}

class Model {
  constructor({
      modelSvg: modelSvgPath,
      properties,
      calculatedProperties,
      species,
      container,
      clickHandlers=[],
      stepsPerSecond=100,
      autoplay=true,
      hotStart=0}) {

    this.timeouts = []
    this.listeners = {}
    this.clickHandlers = clickHandlers
    const {elId, width, height} = container
    this.setSpeed(stepsPerSecond)

    this._onViewClick = this._onViewClick.bind(this)
    this._onViewHover = this._onViewHover.bind(this)

    // initialize loading view
    this.view = new View(null, elId, width, height, this._onViewClick, this._onViewHover)

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
      return Promise.all(imagePaths.map(maybeFetch("svg")))
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

      this.view.setWorld(this.world)

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
    this.maxCatchUpSteps = stepsPerSecond * 2

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
    this._notifyListeners(events.MODEL_STEP)
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

  on(event, listener) {
    if (!this.listeners[event]) {
      this.listeners[event] = []
    }
    this.listeners[event].push(listener)
  }

  _onViewClick(evt) {
    // go through built-in click handlers
    for (let handler of this.clickHandlers) {
      if (!handler.action) continue
      if (util.matches(handler, evt.target, true)) {
        // move agent prop up for easier handling
        if (evt.target._organelle && evt.target._organelle.agent) {
          evt.agent = evt.target._organelle.agent
        }
        handler.action(evt)
      }
    }

    // also notify listeners directly.
    this._notifyViewEvent(events.VIEW_CLICK, evt)
  }

  _onViewHover(evt) {
    if (this.lastTargetHovered && this.lastTargetHovered !== evt.target) {
      const offEvt = {...evt}
      offEvt.target = this.lastTargetHovered
      this._notifyViewEvent(events.VIEW_HOVER_EXIT, offEvt)
    }

    if (!this.lastTargetHovered || this.lastTargetHovered && this.lastTargetHovered !== evt.target) {
      this._notifyViewEvent(events.VIEW_HOVER_ENTER, evt)
    }

    this._notifyViewEvent(events.VIEW_HOVER, evt)

    this.lastTargetHovered = evt.target
  }

  _notifyViewEvent(eventName, evt) {
    if (!evt.target) return
    // first add matches util function for easier click handling in listener
    if (!evt.target._organelle) evt.target._organelle = {}
    evt.target._organelle.matches = (match, checkAncestors=true) => {
      return util.matches(match, evt.target, checkAncestors)
    }

    this._notifyListeners(eventName, evt)
  }

  _notifyListeners(event, evtProps) {
    if (!this.listeners[event]) return
    for (let listener of this.listeners[event]) {
      listener(evtProps)
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
