
var modelDef = {
  modelSvg: '../geniventure-cell/assets/melanocyte.svg',
  species: [
    'triangle.yml'
  ],
  container: {
    elId: "model",
    width: 600,
    height: 600
  }
}

// window.model = new Organelle.Model(modelDef);
Organelle.createModel(modelDef).then((m) => {
  window.model = m
  m.run()
})