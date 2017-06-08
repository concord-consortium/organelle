const should = require('chai').should()

var mock = require('mock-require');
mock('snapsvg', './mock-snap');

// need to require instead of import for mock-require to work
const World = require('../src/world'),
      Agent = require('../src/agent'),
      Rules = require('../src/rules'),
      { getValue, checkExpression } = Rules

describe('Rules', () => {
  describe('getValue', () => {
    it('should return a primitive if a primitive is passed', () => {
      getValue(5).should.equal(5)
      getValue(false).should.equal(false)
    })


    describe('state', () => {
      var world, agent

      beforeEach( () => {
        world = new World({})
        agent = new Agent({}, world)
        agent.state = "test"
      })

      it('should return true if we ask for the same state', () => {
        getValue({state: "test"}, world, agent).should.equal(true)
      })

      it('should return false if we ask for a different state', () => {
        getValue({state: "other"}, world, agent).should.equal(false)
      })

      it('should return true if we ask an existing state in an array', () => {
        getValue({state: ["test", "other"]}, world, agent).should.equal(true)
      })

      it('should return false if we ask an state not in an array', () => {
        getValue({state: ["other", "else"]}, world, agent).should.equal(false)
      })
    })

    describe('fact', () => {
      var world, agent

      beforeEach( () => {
        world = new World({})
        world.setProperty("test", "value1")
        agent = new Agent({}, world)
        agent.setProperty("test", "value2")
        agent.setProperty("true", true)
        agent.setProperty("false", false)
      })

      describe('for agent', () => {
        it('should return an agents property value if we just request that prop', () => {
          getValue({fact: "test"}, world, agent).should.equal("value2")
        })

        it('should return an agents property value if we request agent.prop', () => {
          getValue({fact: "agent.test"}, world, agent).should.equal("value2")
        })
      })

      describe('for world', () => {
        it('should return world property value if we request world.prop', () => {
          getValue({fact: "world.test"}, world, agent).should.equal("value1")
        })
      })

      describe('with default entity', () => {

        it('should return agent property value if we request prop with default entity agent', () => {
          getValue({fact: "test"}, world, agent, agent).should.equal("value2")
        })

        it('should return world property value if we request prop with default entity world', () => {
          getValue({fact: "test"}, world, agent, world).should.equal("value1")
        })
      })

      describe('fact.not', () => {
        it('should return inverse of a bool value', () => {
          getValue({fact: {not: "agent.true"}}, world, agent).should.equal(false)
          getValue({fact: {not: "agent.false"}}, world, agent).should.equal(true)
        })

        it('should return cast and inverse a non-bool value', () => {
          getValue({fact: {not: "agent.test"}}, world, agent).should.equal(false)
        })
      })

    })
  })


  describe('checkExpression', () => {
      var world, agent

      beforeEach( () => {
        world = new World({})
        world.setProperty("test", "value1")
        agent = new Agent({}, world)
        agent.setProperty("five", 5)
        agent.setProperty("true", true)
        agent.setProperty("false", false)
      })

    it('should return an expressions truthy value if passed with no comparator', () => {
      checkExpression(5).should.equal(true)
      checkExpression(false).should.equal(false)
      checkExpression({fact: "world.test"}, world, agent).should.equal(true)
      checkExpression({fact: "world.doesntExist"}, world, agent).should.equal(false)
      checkExpression({fact: "agent.true"}, world, agent).should.equal(true)
      checkExpression({fact: "agent.false"}, world, agent).should.equal(false)
    })

    describe('equals', () => {
      it('should check equality', () => {
        checkExpression({fact: "world.test", equals: "value1"}, world, agent).should.equal(true)
        checkExpression({fact: "world.test", equals: "other"}, world, agent).should.equal(false)
        checkExpression({fact: "agent.true", equals: true}, world, agent).should.equal(true)
        checkExpression({fact: "agent.false", equals: false}, world, agent).should.equal(true)
      })
    })

    describe('numeric comparators', () => {
      it('greaterThan should check >', () => {
        checkExpression({fact: "five", greaterThan: 3}, world, agent).should.equal(true)
        checkExpression({fact: "five", greaterThan: 5}, world, agent).should.equal(false)
      })

      it('lessThan should check <', () => {
        checkExpression({fact: "five", lessThan: 7}, world, agent).should.equal(true)
        checkExpression({fact: "five", lessThan: 5}, world, agent).should.equal(false)
      })

      it('between should check >=, <', () => {
        checkExpression({fact: "five", between: [5, 6]}, world, agent).should.equal(true)
        checkExpression({fact: "five", between: [3, 5]}, world, agent).should.equal(false)
      })
    })
  })
})
