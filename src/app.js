var Snap = require("snapsvg")

module.exports = class Organelle {
  constructor({element, background}) {
    const snap = Snap("#"+element);
    if (background) {
      Snap.load(background, (img) => {
        snap.append(img)
      });
    }
  }
};
