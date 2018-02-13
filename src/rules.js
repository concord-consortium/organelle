function getEntityAndProp(expression, world, agent, baseEntity) {
  baseEntity = baseEntity || agent

  let split = expression.split("."),
      entities = {world, agent},
      entity = split.length > 1 ? entities[split[0]] : baseEntity,
      prop = split.length > 1 ? split[1] : split[0]
  return {entity, prop}
}

function getFactValue(fact, world, agent, baseEntity) {
  let factName = fact.not || fact,
      { entity, prop } = getEntityAndProp(factName, world, agent, baseEntity),
      val = entity.getProperty(prop)
  if (fact.not) {
    // cast to bool and invert
    val = !val
  }
  return val
}

function getAgentCount(statement, world) {
  let count = 0
  for (let agent of world.agents) {
    let matchesSpecies = !statement.species || statement.species === agent.species.name
    // only bother to check rules if we pass the above
    if (matchesSpecies) {
      let rules = Array.isArray(statement.rules) ? statement.rules : [statement.rules]
      if (statement.state) {
        rules.push({state: statement.state})  // make own rule for state
      }
      let matchesRules = rules.every( (rule) => {
            return checkAntecedent(rule, world, agent)
          })
      if (matchesRules) {
        count++
      }
    }
  }
  return count
}

function getValue(statement, world, agent, baseEntity) {
  if (statement.fact) {
    return getFactValue(statement.fact, world, agent, baseEntity)
  } else if (statement.state) {
    let possibleStates = Array.isArray(statement.state) ? statement.state : [statement.state]
    return possibleStates.some( (s) => {
      let { entity, prop: desiredState } = getEntityAndProp(s, world, agent, baseEntity),
          entityState = entity.state
      return entityState === desiredState
    })
  } else if (statement.exists) {
    let feature = world.getPath(statement.exists, agent.props)
    return feature !== null
  } else if (statement.count) {
    return getAgentCount(statement.count, world)
  } else if (statement.ratio) {
    let num = getValue(statement.ratio.numerator, world, agent),
        den = getValue(statement.ratio.denominator, world, agent)
    return num / den
  } else if (statement.random) {
    return getTaggedValue(statement, agent, () => Math.random() < statement.random)
  }
  return statement
}



function getTaggedValue(statement, agent, valueFunc) {
  let tag = getTag(statement)
  if (agent.taggedFacts[tag] !== undefined) {
    return agent.taggedFacts[tag]
  } else {
    let value = valueFunc()
    agent.taggedFacts[tag] = value
    return value
  }
}

function getTag(antecedent) {
  if (antecedent.tag) {
    return antecedent.tag
  } else {
    let tag = Math.random()
    antecedent.tag = tag
    return tag
  }
}

function checkExpression(expression, world, agent, baseEntity) {
  let val = getValue(expression, world, agent, baseEntity),
      res

  if (expression.hasOwnProperty("equals")) {
    res = val == expression.equals
  } else if (expression.lessThan) {
    res = val < expression.lessThan
  } else if (expression.greaterThan) {
    res = val > expression.greaterThan
  } else if (expression.between) {
    res = val >= expression.between[0] && val < expression.between[1]
  } else {
    // cast to bool
    res = !!val
  }

  return res
}

function checkAntecedent(antecedent, world, agent, baseEntity) {
  if (antecedent == null) {
    // always true
    return true
  } else {
    return checkExpression(antecedent, world, agent, baseEntity)
  }
}

function checkAntecedents(antecedents, world, agent, baseEntity) {
  if (antecedents && antecedents.all) {
    for (let antecedent of antecedents.all) {
      if (!checkAntecedent(antecedent, world, agent, baseEntity)) {
        return false
      }
    }
    return true
  } else if (antecedents && antecedents.any) {
    for (let antecedent of antecedents.any) {
      if (checkAntecedent(antecedent, world, agent, baseEntity)) {
        return true
      }
    }
    return false
  } else {
    return checkAntecedent(antecedents, world, agent, baseEntity)
  }
}

/**
 * Gets the currently-applicable array of rules for this agent at this state.
 */
function getRules(agent) {
  if (!agent.species.rules) return []
  let state = agent.state,
      rules = [].concat(agent.species.rules["always"]).concat(agent.species.rules[state])
  return rules.filter(r => !!r)
}

function runRules (world, agent) {
  let consequences = [],
      rules = getRules(agent)
  for (let rule of rules) {
    if (checkAntecedents(rule.if, world, agent, agent)) {
      if (Array.isArray(rule.then)) {
        consequences = consequences.concat(rule.then)
      } else {
        consequences.push(rule.then || rule)
      }
    } else if (rule.else) {
      if (Array.isArray(rule.else)) {
        consequences = consequences.concat(rule.else)
      } else {
        consequences.push(rule.else)
      }
    }
    // some consequences may be rules
    consequences = consequences.filter( c => {
      if (c.if) {
        rules.push(c)
        return false
      }
      return true
    })
  }
  return consequences
}

export default {
  runRules,
  getValue,
  checkExpression,
  getEntityAndProp
}
