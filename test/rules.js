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

    describe('count', () => {
      var world, agent1, agent2, agent3

      beforeEach( () => {
        world = new World({})
        agent1 = world.createAgent({name: "species1"})
        agent2 = world.createAgent({name: "species1"})
        agent3 = world.createAgent({name: "species2"})
        agent1.state = "state1"
        agent2.state = "state2"
        agent3.state = "state2"
        agent1.setProperties({test: "value1", number: 3})
        agent2.setProperties({test: "value2", number: 5})
        agent3.setProperties({test: "value1", number: 7})
      })

      it('should count all agents if we pass no filters', () => {
        getValue({count: {}}, world).should.equal(3)
      })

      it('should count agents matching species', () => {
        getValue({count: {species: "species1"}}, world).should.equal(2)
      })

      it('should count agents matching states', () => {
        getValue({count: {state: "state2"}}, world).should.equal(2)
      })

      it('should count agents matching states array', () => {
        getValue({count: {state: ["state1", "state2"]}}, world).should.equal(3)
      })

      it ('should count agents matching rules', () => {
        getValue({count: {rules: {fact: "test", equals: "value1"}}}, world).should.equal(2)
        getValue({count: {rules: {fact: "number", between: [4, 6]}}}, world).should.equal(1)
      })

      it('should count agents matching combinations of filters', () => {
        getValue({count: {
            species: "species1",
            rules: {fact: "test", equals: "value1"}
          }
        }, world).should.equal(1)
        getValue({count: {
            state: "state2",
            rules: {fact: "test", equals: "value2"}
          }
        }, world).should.equal(1)
        getValue({count: {
            species: "species1",
            state: "state1",
            rules: {fact: "test", equals: "value1"}
          }
        }, world).should.equal(1)
      })
    })

    describe('ratio', () => {
      var world, agent1

      beforeEach( () => {
        world = new World({})
        agent1 = world.createAgent({name: "species1"})
        world.createAgent({name: "species1"})
        world.createAgent({name: "species2"})

        world.setProperty("number", 10)
        agent1.setProperty("number", 5)
      })

      it ('should return ratios of numbers', () => {
        getValue({ratio: {numerator: 1, denominator: 2}}).should.equal(0.5)
      })

      it ('should return ratios of facts', () => {
        getValue({ratio: {
            numerator: {fact: "world.number"},
            denominator: {fact: "number"}
          }
        }, world, agent1).should.equal(2)
      })

      it ('should return ratios of counts', () => {
        getValue({ratio: {
            numerator: {count: {species: "species1"}},
            denominator: {count: {species: "species2"}}
          }
        }, world).should.equal(2)
      })
    })

    describe('random', () => {
      var world, rule

      beforeEach( () => {
        world = new World({})
        for (let i = 0; i < 100; i++) {
          world.createAgent({name: "species"})
        }
        rule = {random: 0.3}
      })

      it('should return True with correct probability', () => {
        let totalTrues = 0
        for (let i = 0; i < 100; i++) {
          if (getValue(rule, world, world.agents[i])) {
            totalTrues++
          }
        }
        totalTrues.should.be.above(10)
        totalTrues.should.be.below(50)
      })

      it('should return the same value for the same agent', () => {
        let totalTrues = 0
        for (let i = 0; i < 10; i++) {
          let val = getValue(rule, world, world.agents[i])
          for (let j = 0; j < 10; j++) {
            getValue(rule, world, world.agents[i]).should.equal(val)
          }
        }
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
