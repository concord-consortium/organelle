function getEntityAndProp(expression, world, agent) {
  let split = expression.split("."),
      entities = {world, agent},
      entity = split.length > 1 ? entities[split[0]] : agent,
      prop = split.length > 1 ? split[1] : split[0]
  return {entity, prop}
}

function getFactValue(fact, world, agent) {
  let factName = fact.not || fact,
      { entity, prop } = getEntityAndProp(factName, world, agent),
      val = entity.getProperty(prop)
  if (fact.not) {
    // cast to bool and invert
    val = !val
  }
  return val
}

function getValue(statement, world, agent) {
  if (statement.fact) {
    return getFactValue(statement.fact, world, agent)
  } else if (statement.state) {
    let { entity, prop } = getEntityAndProp(statement.state, world, agent),
        state = entity.state
    return state === prop
  } else if (statement.count) {
    return getAgentCount(statement, world)
  }
  return statement
}

function checkExpression(expression, world, agent) {
  let val = getValue(expression, world, agent),
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

function checkAntecedent(antecedent, world, agent) {
  if (antecedent == null) {
    // always true
    return true
  } else {
    return checkExpression(antecedent, world, agent)
  }
}

function checkAntecedents(antecedents, world, agent) {
  if (antecedents && antecedents.all) {
    for (let antecedent of antecedents.all) {
      if (!checkAntecedent(antecedent, world, agent)) {
        return false
      }
    }
    return true
  } else if (antecedents && antecedents.any) {
    for (let antecedent of antecedents.any) {
      if (checkAntecedent(antecedent, world, agent)) {
        return true
      }
    }
    return false
  } else {
    return checkAntecedent(antecedents, world, agent)
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
    if (checkAntecedents(rule.if, world, agent)) {
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

module.exports = {
  runRules,
  getValue,
  checkExpression
}
