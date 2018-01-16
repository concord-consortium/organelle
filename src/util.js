module.exports = {
  preventInteraction: function (fabricObj) {
    fabricObj.hasControls = false
    fabricObj.lockMovementX = true
    fabricObj.lockMovementY = true
    fabricObj.hoverCursor = 'default'
  }
}