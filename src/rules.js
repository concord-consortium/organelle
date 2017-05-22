function checkFact(antecedent, agent, world) {
  let fact = antecedent.fact,
      splitFact = fact.split("."),
      entity = splitFact.length > 1 ? splitFact[0] : agent,
      property = splitFact.length > 1 ? splitFact[1] : splitFact[0],
      val = entity.props[property]
  if (antecedent.equals) {
    return val == antecedent.equals
  } else if (antecedent.lessThan) {
    return val < antecedent.lessThan
  } else if (antecedent.greaterThan) {
    return val > antecedent.greaterThan
  } else {
    return val
  }
}

function checkAntecedent(antecedent, agent, world) {
  if (antecedent == null) {
    // always true
    return true
  } else if (antecedent.fact) {
    return checkFact(antecedent, agent, world)
  }
}

function checkAntecedents(antecedents, agent, world) {
  if (antecedents && antecedents.all) {
    for (let antecedent of antecedents.all) {
      if (!checkAntecedent(antecedent, agent, world)) {
        return false
      }
      return true
    }
  } else if (antecedents && antecedents.any) {
    for (let antecedent of antecedents.any) {
      if (checkAntecedent(antecedent, agent, world)) {
        return true
      }
      return false
    }
  } else {
    return checkAntecedent(antecedents, agent, world)
  }
}

/**
 * Gets the currently-applicable array of rules for this agent at this state.
 */
function getRules(agent) {
  let state = agent.state,
      rules = [].concat(agent.species.rules["always"]).concat(agent.species.rules[state])
  return rules.filter(r => !!r)
}

export default function runRules (agent, world) {
  let consequences = [],
      rules = getRules(agent)
  for (let rule of rules) {
    if (checkAntecedents(rule.if, agent, world)) {
      if (Array.isArray(rule.then)) {
        consequences = consequences.concat(rule.then)
      } else {
        consequences.push(rule.then || rule)
      }
    } else if (rule.else) {
      consequences.push(rule.else)
    }
  }
  return consequences
}
