import { getSpecies } from '../backend/species.js'
import {
  BAD_GATEWAY_STATUS,
  BAD_REQUEST_STATUS,
  loadClientSummary,
  safeLoad
} from './submissionViewHelpers.js'

const pageName = 'submission-02-species'
const nextPageName = 'submission-02-animal-details'
const OTHER = 'other'
const COMMON_SPECIES = ['Cattle', 'Sheep', 'Chicken', 'Pig', 'Turkey', 'Duck', 'Alpaca', 'Goat']

const getSavedSpeciesSelection = (savedSpecies) => {
  if (!savedSpecies) {
    return undefined
  }

  return COMMON_SPECIES.includes(savedSpecies) ? savedSpecies : OTHER
}

const getSpeciesSelection = (selection, otherSpecies) => {
  const errors = {}
  let speciesName

  if (COMMON_SPECIES.includes(selection)) {
    speciesName = selection
  } else if (selection === OTHER) {
    if (!otherSpecies) {
      errors.otherSpecies = 'Specify the species'
    } else {
      speciesName = otherSpecies
    }
  } else {
    errors.species = 'Select a species'
  }

  return { speciesName, errors }
}

const findSelectedSpecies = async (speciesName, selection, errors) => {
  if (!speciesName) {
    return undefined
  }

  const speciesResult = await safeLoad(getSpecies)
  const matchedSpecies = speciesResult.data?.find(({ name }) => name === speciesName)

  if (!matchedSpecies) {
    const errorField = selection === OTHER ? 'otherSpecies' : 'species'
    errors[errorField] = speciesResult.error
      ? 'The species list is unavailable. Try again later'
      : 'Select a species from the list'
  }

  return matchedSpecies
}

const buildViewContext = async (submissionFormState, { selection, otherSpecies, errors = {} } = {}) => {
  const [speciesResult, clientSummaryResult] = await Promise.all([
    safeLoad(getSpecies),
    loadClientSummary(submissionFormState)
  ])
  const allSpecies = speciesResult.data || []
  const savedSpecies = submissionFormState.formData?.animalDetails?.species
  const savedIsCommon = COMMON_SPECIES.includes(savedSpecies)

  const currentSelection = selection ?? getSavedSpeciesSelection(savedSpecies)
  const currentOther = otherSpecies ?? (savedSpecies && !savedIsCommon ? savedSpecies : '')

  return {
    submissionFormState,
    ...clientSummaryResult,
    speciesItems: COMMON_SPECIES.map((name) => ({
      value: name,
      text: name,
      checked: currentSelection === name
    })),
    otherChecked: currentSelection === OTHER,
    otherSpeciesOptions: [
      { value: '', text: 'Select a species', selected: !currentOther },
      ...allSpecies.map(({ name }) => ({ value: name, text: name, selected: name === currentOther }))
    ],
    otherSpecies: currentOther,
    errors,
    speciesListUnavailable: Boolean(speciesResult.error)
  }
}

const submissionSpecies = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const context = await buildViewContext(submissionFormState)
        const view = h.view('submission-species.njk', context)

        return context.clientSummaryError ? view.code(BAD_GATEWAY_STATUS) : view
      }
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const selection = request.payload?.species
        const otherSpecies = request.payload?.otherSpecies || ''
        const { speciesName, errors } = getSpeciesSelection(selection, otherSpecies)
        const matchedSpecies = await findSelectedSpecies(speciesName, selection, errors)

        if (Object.keys(errors).length > 0) {
          const context = await buildViewContext(submissionFormState, { selection, otherSpecies, errors })
          const view = h.view('submission-species.njk', context)

          return context.clientSummaryError
            ? view.code(BAD_GATEWAY_STATUS)
            : view.code(BAD_REQUEST_STATUS)
        }

        const formData = submissionFormState.formData || {}
        const previous = formData.animalDetails
        // Changing species invalidates answers that depend on the previous species.
        const retained = previous?.speciesId === matchedSpecies.speciesId ? previous : {}

        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: {
            ...formData,
            animalDetails: {
              ...retained,
              speciesId: matchedSpecies.speciesId,
              species: matchedSpecies.name
            }
          }
        })
        request.yar.touch()

        return h.redirect(`/${nextPageName}`)
      }
    }
  ])
}

export default submissionSpecies
