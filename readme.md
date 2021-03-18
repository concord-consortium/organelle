




# Organelle
[![Build Status](https://travis-ci.org/concord-consortium/organelle.svg?branch=master)](https://travis-ci.org/concord-consortium/organelle) [![Package version](https://img.shields.io/npm/v/organelle.svg)](https://www.npmjs.com/package/organelle/)

An agent-based modeling library based on SVG and declarative rules.

## Installation

Organelle can be used both as a library installed with NPM, or by including the script file directly.

### NPM

```
npm install organelle
```

```js
import * as Organelle from 'organelle'
// or
var Organelle = require('organelle')

Organelle.createModel({...})
```

### Script

```html
<script src="https://organelle.concord.org/organelle.js"></script>
// or
<script src="https://organelle.concord.org/version/0.0.1/organelle.js"></script>
<script>
  var Organelle = window.Organelle
</script>
```

## Developer setup

2. Run `npm install` to pull dependencies
3. Run `npm start` to run `webpack-dev-server` in development mode with hot module replacement

## Goals for 1.0 release:

1. Replace rendering with Fabric.js ✓
2. Build as both importable library and as a global variable ✓
3. Improve documentation
4. Add tests for agent tasks and world props