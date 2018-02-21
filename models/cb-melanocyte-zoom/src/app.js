var model,
    continuousBinding = false,
    oldHexSpawnDef;

Organelle.createModel({
  container: {
    elId: "model",
    width: 960,
    height: 600
  },
  modelSvg: "assets/melanocyte.svg",
  bounds: {
    left: 565,
    top: 180,
    width: 200,
    height: 125
  },
  properties: {
    albino: false,
    working_tyr1: false,
    working_myosin_5a: true,
    open_gates: true,
    working_receptor: true,
    hormone_bound: false,
    g_protein_bound: false
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
              greaterThan: 0.7
            }
          }
        },
        denominator: {
          count: {
            species: "melanosome",
            state: ["waiting_on_actin_terminal", "waiting_on_nuclear_actin_terminal"],
            rules: {
              fact: "size",
              lessThan: 0.7
            }
          }
        }
      }
    }
  },
  species: [
    "organelles/melanosome.yml",
    "organelles/hexagon.yml",
    "organelles/triangle.yml",
    "organelles/g-protein.yml",
    "organelles/g-protein-body.yml",
    "organelles/g-protein-part.yml"
  ],
  hotStart: 1500
}).then(function(m) {
  window.model = m
  model = m

  model.on("view.loaded", () => {
    transformReceptor()
  })

  model.setTimeout( () => {
    for (var i=0; i < 3; i++) {
      model.world.createAgent(model.world.species.gProtein)
    }
  }, 1300)

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
      cellFill.setColor(colorStr)
      // cellFill.set({opacity: saturation})

      if (model.world.getProperty("open_gates") && !model.world.getProperty("albino")) {
        const backgroundFill = model.view.getModelSvgObjectById("backcell_x5F_color")
        backgroundFill.setColor(colorStr)
        // backgroundFill.set({opacity: Math.max(0.5, saturation)})
      }
    }
  })

  model.on("view.click", evt => {
    console.log("click!", evt.target.id)

    if (evt.target._organelle.matches({selector: ".gate"})) {
      console.log("clicked a gate", evt.target)
    }
    if (evt.target._organelle.matches({species: "melanosome"})) {
      console.log("clicked a melanosome", evt.target._organelle.agent)
    }
  })

  model.on("hexagon.notify", evt => {
    transformReceptor()
    if (!model.world.getProperty("hormone_bound") && continuousBinding) {
      sendHexToReceptor()
    }
  })

  model.on("gProtein.notify.break_time", evt => {
    let proteinToBreak = evt.agent;
    var body = model.world.createAgent(model.world.species.gProteinBody);
    body.setProperties({x: proteinToBreak.getProperty("x"), y: proteinToBreak.getProperty("y")})

    var part = model.world.createAgent(model.world.species.gProteinPart);
    part.setProperties({x: proteinToBreak.getProperty("x"), y: proteinToBreak.getProperty("y")})

    proteinToBreak.die()

    model.world.setProperty("g_protein_bound", false)

    model.world.createAgent(model.world.species.gProtein)
  })
});

function transformReceptor() {
  if (model.world.getProperty("working_receptor")) {
    model.view.hide("#receptor_x5F_protein_broken", true)
    if (model.world.getProperty("hormone_bound")) {
      model.view.hide("#receptor_x5F_protein", true)
      model.view.show("#receptor_x5F_protein_bound", true)
    } else {
      model.view.show("#receptor_x5F_protein", true)
      model.view.hide("#receptor_x5F_protein_bound", true)
    }
  } else {
    model.view.hide("#receptor_x5F_protein", true)
    model.view.hide("#receptor_x5F_protein_bound", true)
    model.view.show("#receptor_x5F_protein_broken", true)
  }
}

function sendHexToReceptor() {
  bindingAgent = model.world.createAgent(model.world.species.hexagon);
  bindingAgent.state = "heading_to_receptor";
}

function showContinuousBinding() {
  continuousBinding = true
  // add new g-proteins removed by manual mode
  let gCount = model.world.agents.filter(a => a.species.name === "gProtein").length
  // allow new hexes to be born
  if (oldHexSpawnDef) {
    model.world.species.hexagon.spawn.every = oldHexSpawnDef
  }
  for (var i=0; i < 3-gCount; i++) {
    model.world.createAgent(model.world.species.gProtein)
  }
  function sendHexToReceptorOccasionally() {
    sendHexToReceptor()
    var nextTime = Math.floor(Math.random() * 10000)
    model.setTimeout(sendHexToReceptorOccasionally, nextTime)
  }
  sendHexToReceptorOccasionally()
}

function manualMode() {
  continuousBinding = false
  // don't create any new hexes
  oldHexSpawnDef = model.world.species.hexagon.spawn.every
  model.world.species.hexagon.spawn.every = 0
  // kill all existing hexes and gProteins
  for (agent of model.world.agents) {
    if (agent.species.name === "gProtein" || agent.species.name === "hexagon") {
      agent.die()
    }
  }
  model.setTimeout(() => {
    model.world.setProperty("g_protein_bound", false)
    model.world.setProperty("hormone_bound", false)
    console.log("after timeout", model.world.getProperty("hormone_bound"))
  }, 1);
}

function sendSingleHex() {
  sendHexToReceptor()
}

function sendSingleGP() {
  model.world.createAgent(model.world.species.gProtein)
}

function toggleBrokenReceptor() {
  const wasWorking = model.world.getProperty("working_receptor")
  model.world.setProperty("working_receptor", !wasWorking)
  transformReceptor()

  // knock off any existing proteins.
  // (this could also be in agent def, but seems specific to this toggle button)
  if (wasWorking) {
    for (agent of model.world.agents) {
      if (agent.species.name === "gProtein" && (agent.state === "bound" || agent.state === "waiting_to_break")) {
        agent.state = "away"
      }
    }
  }
}