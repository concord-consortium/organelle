
Snap.plugin( function( Snap, Element, Paper, global ) {
    Element.prototype.nativeAttrs = function( attrs ) {
        for (var p in attrs)
            this.node.setAttributeNS(null, p, attrs[p]);
        return this;
    }
});
