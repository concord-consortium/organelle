var model,
    addingHormone = false;

Organelle.createModel({
  container: {
    elId: "model",
    width: 960,
    height: 600
  },
  modelSvg: "assets/melanocyte.svg",
  properties: {
    albino: false,
    working_tyr1: true,
    working_myosin_5a: true,
    open_gates: false,
    activated_g_protein: 20,
    hormone_spawn_period: 0
  },
  calculatedProperties: {
    saturation: {
      ratio: {
        numerator: {
          count: {
            species: "melanosome",
            state: [
              "waiting_on_actin_terminal",
              "waiting_on_nuclear_actin_terminal"
            ],
          }
        },
        denominator: 20
      }
    },
    lightness: {
      ratio: {
        numerator: {
          count: {
            species: "melanosome",
            state: "waiting_on_nuclear_actin_terminal"
          }
        },
        denominator: 10
      }
    },
    grayness: {
      ratio: {
        numerator: {
          count: {
            species: "melanosome",
            state: [
              "waiting_on_actin_terminal",
              "waiting_on_nuclear_actin_terminal"
            ],
            rules: {
              fact: "size",
              greaterThan: 0.71
            }
          }
        },
        denominator: {
          count: {
            species: "melanosome",
            state: ["waiting_on_actin_terminal", "waiting_on_nuclear_actin_terminal"],
            rules: {
              fact: "size",
              lessThan: 0.71
            }
          }
        }
      }
    }
  },
  species: [
    "organelles/melanosome.yml",
    "organelles/dots.yml",
    "organelles/red-dots.yml"
  ],
  hotStart: 1500
}).then(function(m) {
  window.model = m;
  model = m;

  model.on("model.step", () => {
    let saturation = Math.min(model.world.getProperty("saturation"), 1) || 0,
        lightness = Math.min(model.world.getProperty("lightness"), 1),
        grayness = Math.min(model.world.getProperty("grayness"), 1)

    if (isNaN(lightness)) {
      lightness = 0
    }
    if (isNaN(grayness)) {
      grayness = 1
    }

    let gray = [123,116,110],
        orange = [200, 147, 107],
        color = gray.map( (g, i) => Math.floor(((g * grayness) + (orange[i] * (1-grayness))) + lightness * 30) ),
        colorStr = "rgb("+color.join()+")"

    const cellFill = model.view.getModelSvgObjectById("cellshape_0_Layer0_0_FILL")
    if (cellFill) {
      cellFill.set('fill', colorStr)
      // cellFill.set({opacity: saturation})

      if (model.world.getProperty("open_gates") && !model.world.getProperty("albino")) {
        const backgroundFill = model.view.getModelSvgObjectById("backcell_x5F_color")
        backgroundFill.set('fill', colorStr)
        // backgroundFill.set({opacity: Math.max(0.5, saturation)})
      }
    }
  })

  model.on("view.click", evt => {
    console.log("click!", evt.target.id)

    const loc = model.view.transformToWorldCoordinates({x: evt.e.offsetX, y: evt.e.offsetY})
    if (evt.target._organelle.matches({selector: "#intercell"})) {
      clickIntercell(loc)
    } else {
      clickElsewhere(loc)
    }
  })
});

function makeTransparent() {
  makeEverythingTransparentExcept({})

  model.on("view.hover", evt => {
    if (evt.target) console.log(evt.target.id)
  })

  model.on("view.hover.enter", evt => {
    const highlightClasses = [
      ".gate-a",
      ".gate-b",
      ".gate-c",
      ".gate-d",
      "#golgi_x5F_apparatus",
      "#nucleus"
    ].join(",")
    let matches = evt.target._organelle.matches({selector: highlightClasses});
    if (matches) {
      makeEverythingOpaque()
      makeEverythingTransparentExcept({selector: matches})
    }
  })

  model.on("view.hover.exit", evt => {
    makeEverythingOpaque()
    makeEverythingTransparentExcept({})
  })
}

function makeEverythingTransparentExcept(skip) {
  model.view.setPropertiesOnAllObjects({opacity: "*0.2"}, true, skip, true)
}

function makeEverythingOpaque() {
  model.view.resetPropertiesOnAllObjects()
}

function sayHiCytoplasm() {
  console.log("cytoplasm says hi")
}

function sayHiMelanosome(evt) {
  console.log("melansome says hi", evt.agent)
}

let zoomed = false
function zoomToReceptor() {
  if (!zoomed) {
    model.zoom(7, {x: 500, y: 180}, 800)
    document.getElementById("button-zoom").innerHTML = "Zoom out"
    model.view.show("#receptor_x5F_protein", true)
    model.view.hide("#receptor_zoomed_out", true)
    zoomed = true
  } else {
    model.resetZoom(800)
    document.getElementById("button-zoom").innerHTML = "Zoom to receptor"
    model.view.hide("#receptor_x5F_protein", true)
    model.view.show("#receptor_zoomed_out", true)
    zoomed = false
  }

}

let gproteinSlider = document.getElementById("activated_g_protein")
gproteinSlider.oninput = function() {
  model.world.setProperty("activated_g_protein", this.value)
}

let hormoneSpawnSlider = document.getElementById("hormone_level")
hormoneSpawnSlider.oninput = function() {
  let rate = this.value * 1
  let period = rate === 0 ? 0 : Math.floor(500 / rate)
  console.log(period)
  model.world.setProperty("hormone_spawn_period", period)
}

function hormonePulse() {
  model.world.setProperty("hormone_spawn_period", 5)
  document.getElementById("hormone_level").value = 100
  model.setTimeout( () => {
    model.world.setProperty("hormone_spawn_period", 20)
    document.getElementById("hormone_level").value = 25
  }, 2000)
  model.setTimeout( () => {
    model.world.setProperty("hormone_spawn_period", 0)
    document.getElementById("hormone_level").value = 0
  }, 2400)
}

function addAgent(species, state, props, number) {
  for (let i = 0; i < number; i++) {
    const a = model.world.createAgent(model.world.species[species])
    a.state = state
    a.setProperties(props)
  }
}

document.getElementById('select-add-hormone').addEventListener('click', function(e) {
  addingHormone = this.checked
});

function clickIntercell(loc) {
  if (!addingHormone) return
  let added = 0;
  function addHormone() {
    addAgent("red-dot", "find_path_from_anywhere", loc, 3)
    added++
    if (added < 8) {
      model.setTimeout(addHormone, 150)
    }
  }
  addHormone()
}

function clickElsewhere(loc) {
  if (!addingHormone) return
  let added = 0;
  function addHormone() {
    addAgent("red-dot", "diffuse", {speed: 0.4, x: loc.x, y: loc.y}, 2)
    added++
    if (added < 6) {
      model.setTimeout(addHormone, 150)
    }
  }
  addHormone()
}