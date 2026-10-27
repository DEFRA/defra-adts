const toOptions = (options) => {
  if (!Array.isArray(options)) {
    return []
  }

  return options
    .filter((option) => option && option.value != null && option.label)
    .map((option) => ({ value: String(option.value), label: String(option.label) }))
}

export const toSpeciesList = (payload) => {
  if (!Array.isArray(payload)) {
    throw new TypeError('Species payload must be an array')
  }

  return payload
    .filter((item) => item && item.speciesId != null && item.name)
    .map((item) => ({ speciesId: String(item.speciesId), name: String(item.name) }))
}

// Normalises downstream data into the contract consumed by the UI. Missing option lists become empty,
// which the UI treats as "field not shown for this species".
export const toAnimalDetails = (payload, speciesId) => {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new TypeError('Animal details payload must be an object')
  }

  return {
    speciesId: String(speciesId),
    ageCategories: toOptions(payload.ageCategories),
    purposes: toOptions(payload.purposes),
    keepingTypes: toOptions(payload.keepingTypes),
    breeds: toOptions(payload.breeds),
    sexes: toOptions(payload.sexes),
    organicAccreditationApplicable: payload.organicAccreditationApplicable === true
  }
}
