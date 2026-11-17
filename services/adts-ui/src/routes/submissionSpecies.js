import { getSpecies } from '../backend/species.js'
import {
  BAD_GATEWAY_STATUS,
  BAD_REQUEST_STATUS,
  loadClientSummary,
  safeLoad
} from './submissionViewHelpers.js'

const pageName = 'submission-02-species'
const nextPageName = 'submission-02-animal-details'
const getSpeciesSelection = (selection) => {
  const errors = {}

  if (!selection) {
    errors.species = 'Select a species'
  }

  return { speciesName: selection, errors }
}

const findSelectedSpecies = async (speciesName, errors) => {
  if (!speciesName) {
    return undefined
  }

  const speciesResult = await safeLoad(getSpecies)
  const matchedSpecies = speciesResult.data?.find(({ name }) => name === speciesName)

  if (!matchedSpecies) {
    errors.species = speciesResult.error
      ? 'The species list is unavailable. Try again later'
      : 'Select a species from the list'
  }

  return matchedSpecies
}

const buildViewContext = async (submissionFormState, { selection, errors = {} } = {}) => {
  const [speciesResult, clientSummaryResult] = await Promise.all([
    safeLoad(getSpecies),
    loadClientSummary(submissionFormState)
  ])
  const allSpecies = speciesResult.data || []
  const savedSpecies = submissionFormState.formData?.animalDetails?.species
  const currentSelection = selection ?? savedSpecies ?? ''

  return {
    submissionFormState,
    ...clientSummaryResult,
    speciesOptions: [
      { value: '', text: 'Select a species', selected: !currentSelection },
      ...allSpecies.map(({ name }) => ({
        value: name,
        text: name,
        selected: name === currentSelection
      }))
    ],
    selectedSpecies: currentSelection,
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
        const { speciesName, errors } = getSpeciesSelection(selection)
        const matchedSpecies = await findSelectedSpecies(speciesName, errors)

        if (Object.keys(errors).length > 0) {
          const context = await buildViewContext(submissionFormState, { selection, errors })
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
