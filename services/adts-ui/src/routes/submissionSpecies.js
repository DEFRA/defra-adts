import { getClients } from '../backend/clients.js'
import { getSpecies } from '../backend/species.js'

const pageName = 'submission-02-species'
const nextPageName = 'submission-02-animal-details'
const OTHER = 'other'
const COMMON_SPECIES = ['Cattle', 'Sheep', 'Chicken', 'Pig', 'Turkey', 'Duck', 'Alpaca', 'Goat']

export const safeLoad = async (loader) => {
  try {
    return { data: await loader() }
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
    return { error }
  }
}

export const getClientSummary = (clients, clientId) => {
  const client = clients.find((item) => item.clientId === clientId)

  return {
    name: client?.name || 'No client name set',
    address: [client?.addressLine1, client?.addressLine2, client?.addressLine3, client?.postcode]
      .filter(Boolean)
      .join(', ') || 'No address set',
    cph: client?.cph || 'No CPH number set'
  }
}

export const loadClientSummary = async (submissionFormState) => {
  const clientsResult = await safeLoad(getClients)

  return getClientSummary(clientsResult.data || [], submissionFormState.formData?.clientDetails?.clientId)
}

const buildViewContext = async (submissionFormState, { selection, otherSpecies, errors = {} } = {}) => {
  const [speciesResult, clientSummary] = await Promise.all([
    safeLoad(getSpecies),
    loadClientSummary(submissionFormState)
  ])
  const allSpecies = speciesResult.data || []
  const savedSpecies = submissionFormState.formData?.animalDetails?.species
  const savedIsCommon = COMMON_SPECIES.includes(savedSpecies)

  const currentSelection = selection ?? (savedSpecies ? (savedIsCommon ? savedSpecies : OTHER) : undefined)
  const currentOther = otherSpecies ?? (savedSpecies && !savedIsCommon ? savedSpecies : '')

  return {
    submissionFormState,
    clientSummary,
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

        return h.view('submission-species.njk', await buildViewContext(submissionFormState))
      }
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const selection = request.payload?.species
        const otherSpecies = request.payload?.otherSpecies || ''
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

        // The backend list is the source of truth for the speciesId that drives the next page.
        let matchedSpecies
        if (speciesName) {
          const speciesResult = await safeLoad(getSpecies)
          matchedSpecies = speciesResult.data?.find(({ name }) => name === speciesName)

          if (!matchedSpecies) {
            errors[selection === OTHER ? 'otherSpecies' : 'species'] = speciesResult.error
              ? 'The species list is unavailable. Try again later'
              : 'Select a species from the list'
          }
        }

        if (Object.keys(errors).length > 0) {
          const context = await buildViewContext(submissionFormState, { selection, otherSpecies, errors })

          return h.view('submission-species.njk', context).code(400)
        }

        const formData = submissionFormState.formData || {}
        const previous = formData.animalDetails
        // Changing species invalidates answers that depend on the previous species.
        const retained = previous?.speciesId === matchedSpecies.speciesId ? previous : {}

        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: {
            ...formData,
            animalDetails: { ...retained, speciesId: matchedSpecies.speciesId, species: matchedSpecies.name }
          }
        })
        request.yar.touch()

        return h.redirect(`/${nextPageName}`)
      }
    }
  ])
}

export default submissionSpecies
