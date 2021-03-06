var model,
    initialDrakeColor = "lava",
    finalDrakeColor = "charcoal",
    alleles,
    numStars,
    gameType = "size", // "gate", "nucleus"
    isNucleusGame = false,
    nucleusGenes,
    gameUrl = "https://www.fablevision.com/geniverse_proteins/index.html?allele-shorthand=10111111&initial-state=size&target-color=lava",
    parentPhone

  Organelle.createModel({
    container: {
      elId: "model",
      width: 960,
      height: 600
    },
    modelSvg: "assets/melanocyte.svg",
    properties: {
      albino: true,
      working_tyr1: true,
      working_myosin_5a: true,
      open_gates: false
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
      "organelles/zoomed-melanosome.yml",
      "organelles/dots.yml"
    ],
    hotStart: 1000,
    clickHandlers: [
      {
        selector: "#golgi_x5F_apparatus",
        action: enterSizeGame
      },
      {
        selector: ".gate",
        action: enterGatesGame
      },
      {
        selector: "#nucleus_x5F_A",
        action: enterNucleusGame
      }
    ]
  }).then(function(m) {
    window.model = m
    model = m;

    var urlParams
    (window.onpopstate = function () {
        var match,
            pl     = /\+/g,  // Regex for replacing addition symbol with a space
            search = /([^&=]+)=?([^&]*)/g,
            decode = function (s) { return decodeURIComponent(s.replace(pl, " ")) },
            query  = window.location.search.substring(1)

        urlParams = {}
        while (match = search.exec(query))
            urlParams[decode(match[1])] = decode(match[2])

        alleles = urlParams.alleles
        numStars = urlParams.numStars

        gameType = urlParams.game || "size"

        nucleusGenes = urlParams.nucleusGenes || null
        isNucleusGame = !!nucleusGenes

        let challenge = urlParams.chal
        if (challenge) {
          initialDrakeColor = challenge.split("-")[0]
          finalDrakeColor = challenge.split("-")[1]
          console.log(initialDrakeColor)
          setCellPhenotype(initialDrakeColor)
          setGameUrl(initialDrakeColor, finalDrakeColor)
        }
    })();

    function glow(bool) {
      let els = Array.from(document.getElementsByClassName(gameType+"-glow")),
          style = bool ? "url(#glow)" : ""
      els.forEach( (el) => el.style["filter"] = style )

      model.setTimeout(() => glow(!bool),1000)
    }

    glow(true)

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
        cellFill.set({opacity: saturation})

        if (model.world.getProperty("open_gates") && !model.world.getProperty("albino")) {
          const backgroundFill = model.view.getModelSvgObjectById("backcell_x5F_color")
          backgroundFill.set('fill', colorStr)
          backgroundFill.set({opacity: Math.max(0.5, saturation)})
        }
      }
    })
  });

  function addClass(el, className) {
    if (el.classList)
      el.classList.add(className);
    else
      el.className += ' ' + className;
  }

  function removeClass(el, className) {
    if (el.classList)
      el.classList.remove(className);
    else
      el.className = el.className.replace(new RegExp('(^|\\b)' + className.split(' ').join('|') + '(\\b|$)', 'gi'), ' ');
  }

  var iframe = document.getElementById("protein-game"),
      wrapper = document.getElementById("protein-game-wrapper"),
      entering = false,
      createdAgent,
      reverseZoom;

  function enterSizeGame(Snap, svg) {
    if (entering || gameType !== "size") {
      return
    }
    entering = true

    iframe.src = gameUrl

    let iframeDelay = 500;
    model.zoom(16, {x: 320.5, y: 405.5}, 1200).then(() => {
      createdAgent = model.world.createAgent(model.world.species.zoomedMelanosome)
      model.on("zoomedMelanosome.notify.grown", () => {
        model.stop()
        setTimeout( () => {
          var phone = new iframePhone.ParentEndpoint(iframe)
          phone.addListener('activityExit', function (content) {
            console.log("exit")
            setTimeout(exitProteinGame, 200)
          })
          phone.addListener('activityWin', function (content) {
            console.log("win!")
            setTimeout(exitProteinGame, 200)
            setCellPhenotype(finalDrakeColor)
            model.setTimeout( () => {console.log("win!!!"); parentPhone.post('challengeWin')}, 4000)
          })

          removeClass(wrapper, "hidden-iframe")
        }, iframeDelay)
      })
    })
    // Snap.animate(svg.attr("viewBox").vb.split(" "), [391, 518, 72, 45],
    //   function (vals) { svg.attr("viewBox", vals.join(" ")); }, zoomDelay
    // );

    // model.setTimeout( () => {
    //   createdAgent = model.world.createAgent(model.world.species[1])
    // }, zoomDelay)
    // model.setTimeout( () => {
    //   var phone = new iframePhone.ParentEndpoint(iframe)
    //   phone.addListener('activityExit', function (content) {
    //     console.log("exit")
    //     setTimeout(exitProteinGame, 1000)
    //   })
    //   phone.addListener('activityWin', function (content) {
    //     console.log("win!")
    //     setTimeout(exitProteinGame, 1000)
    //     setCellPhenotype(finalDrakeColor)
    //     model.setTimeout( () => {console.log("win!!!"); parentPhone.post('challengeWin')}, 4000)
    //   })

    //   removeClass(wrapper, "hidden-iframe")
    // }, iframeDelay)
    // model.setTimeout( () => {
    //   model.stop()
    // }, modelStopDelay)

    // reverseZoom = function() {
    //   Snap.animate(svg.attr("viewBox").vb.split(" "), [0, 0, 1280, 800],
    //     function (vals) { svg.attr("viewBox", vals.join(" ")); }, 1500
    //   )
    // }
  }


  function exitProteinGame() {
    addClass(wrapper, "temp-iframe");

    if (gameType === "size") {
      createdAgent.setProperty("size", 0.1)
      createdAgent.state = "growing"
    }
    model.step(600)

    setTimeout(function() {
      iframe.src = ""
      model.resetZoom(1500)
      addClass(wrapper, "hidden-iframe")
      removeClass(wrapper, "temp-iframe")

      model.setTimeout(function() {
        if (gameType === "size") {
          createdAgent.species = model.world.species.melanosome
          createdAgent.state = "seeking_microtuble"
        }
        entering = false
      }, 600)
      model.run()
    }, 1000)
  }

  function enterGatesGame(Snap, svg, el) {
    if (entering || gameType !== "gate") {
      return
    }
    entering = true

    iframe.src = gameUrl

    let zoomDelay = 1300,
        iframeDelay = 1100,
        // iframeDelay = initialDrakeColor === "albino" ? 1800 : initialDrakeColor === "lava" ? 2300 : 2800,
        modelStopDelay = 2000
    let {x, y} = el.node.getBBox()
    Snap.animate(svg.attr("viewBox").vb.split(" "), [x-15, y-5, 72, 45],
      function (vals) { svg.attr("viewBox", vals.join(" ")); }, zoomDelay
    );

    // model.setTimeout( () => {
    //   createdAgent = model.world.createAgent(model.world.species[1])
    // }, zoomDelay)
    model.setTimeout( () => {
      var phone = new iframePhone.ParentEndpoint(iframe)
      phone.addListener('activityExit', function (content) {
        setTimeout(exitProteinGame, 1000)
      })
      phone.addListener('activityWin', function (content) {
        setTimeout(exitProteinGame, 1000)
        console.log("win!")
        setCellPhenotype(finalDrakeColor)
        model.setTimeout( () => {console.log("win!!!"); parentPhone.post('challengeWin')}, 4000)
      })

      removeClass(wrapper, "hidden-iframe")
    }, iframeDelay)
    model.setTimeout( () => {
      model.stop()
    }, modelStopDelay)

    reverseZoom = function() {
      Snap.animate(svg.attr("viewBox").vb.split(" "), [0, 0, 1280, 800],
        function (vals) { svg.attr("viewBox", vals.join(" ")); }, 1500
      )
    }
  }

  function enterNucleusGame(Snap, svg, el) {
    if (entering || gameType !== "nucleus") {
      return
    }
    entering = true

    iframe.src = gameUrl

    let zoomDelay = 1300,
        iframeDelay = 1100,
        // iframeDelay = initialDrakeColor === "albino" ? 1800 : initialDrakeColor === "lava" ? 2300 : 2800,
        modelStopDelay = 2000
    let {x, y} = el.node.getBBox()
    Snap.animate(svg.attr("viewBox").vb.split(" "), [x+40, y+15, 72, 45],
      function (vals) { svg.attr("viewBox", vals.join(" ")); }, zoomDelay
    );

    // model.setTimeout( () => {
    //   createdAgent = model.world.createAgent(model.world.species[1])
    // }, zoomDelay)
    model.setTimeout( () => {
      var phone = new iframePhone.ParentEndpoint(iframe)
      phone.addListener('activityExit', function (content) {
        setCellPhenotype(content.resultingGeneticColor)
        setGameUrl(content.resultingGeneticColor, finalDrakeColor, true)
        setTimeout(exitProteinGame, 500)
        if (content.resultingGeneticColor === finalDrakeColor) {
          model.setTimeout( () => {console.log("win!!!"); parentPhone.post('challengeWin')}, 4000)
        }
      })

      removeClass(wrapper, "hidden-iframe")
    }, iframeDelay)
    model.setTimeout( () => {
      model.stop()
    }, modelStopDelay)

    reverseZoom = function() {
      Snap.animate(svg.attr("viewBox").vb.split(" "), [0, 0, 1280, 800],
        function (vals) { svg.attr("viewBox", vals.join(" ")); }, 1500
      )
    }
  }

  function setGatesProp(open) {
    // FIXME, need rendered callback
    if (document.getElementById("gate_A") === null) {
      setTimeout( () => { setGatesProp(open) }, 500)
    } else {
      let type = open ? "_open" : "_closed"
      for (let id of ["gate_A", "gate_B", "gate_C", "gate_D"]) {
        document.getElementById(id).setAttribute("xlink:href", "#"+id+type)
      }
    }
  }

  function observePropCheckbox(prop, callback) {
    document.getElementById(prop).onclick = function() {
      let val = document.getElementById(prop).checked
      model.world.setProperty(prop, val)
      if (callback) {
        callback(val)
      }
    }
  }
  function setPropCheckbox(prop, value) {
    model.world.setProperty(prop, value)
    document.getElementById(prop).checked = value
    if (prop === "open_gates") setGatesProp(value)
  }
  observePropCheckbox("albino")
  observePropCheckbox("working_tyr1")
  observePropCheckbox("working_myosin_5a")
  observePropCheckbox("open_gates", setGatesProp)

  function setCellPhenotype(color) {
    let colorProps = {
              // albino tyr1   myo5   gates
      frost:    [true,  false, false, false],
      charcoal: [false, true,  true,  true],
      steel:    [false, true,  true,  false],
      ash:      [false, true,  false, true],
      silver:   [false, true,  false, false],
      lava:     [false, false, true,  true],
      copper:   [false, false, true,  false],
      sand:     [false, false, false, true],
      gold:     [false, false, false, false],
    }

    setPropCheckbox("albino", colorProps[color][0])
    setPropCheckbox("working_tyr1", colorProps[color][1])
    setPropCheckbox("working_myosin_5a", colorProps[color][2])
    setPropCheckbox("open_gates", colorProps[color][3])

    model.step(800)
  }

  function setGameUrl(initial, final, forceNewShorthand) {
    let alleleShorthand, stars

    if (alleles && !forceNewShorthand) {
      alleleShorthand = alleles
    } else {
      let alleleShorthands = {
                // t a m g?
        frost:    "11001111",
        charcoal: "10111111",
        steel:    "10111100",
        lava:     "00111111",
        copper:   "00111110",
        sand:     "00110011"
      }
      alleleShorthand = alleleShorthands[initial]
    }
    stars = numStars ? "&num-stars="+numStars : ""

    let nucleusString = ""
    if (isNucleusGame) {
      nucleusString = "&nucleus=true&relevant-gene-shorthand="+nucleusGenes
    }


    gameUrl = "https://www.fablevision.com/geniverse_proteins/index.html?allele-shorthand="+alleleShorthand+"&initial-state="+gameType+"&target-color="+final+stars+nucleusString
  }

  parentPhone = iframePhone.getIFrameEndpoint()
  parentPhone.initialize()