module.exports = {
  preventInteraction: function (fabricObj) {
    fabricObj.selectable = false
    fabricObj.hoverCursor = 'default'
  }
}