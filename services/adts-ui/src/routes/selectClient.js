import Joi from 'joi'
import { getClients } from '../backend/clients.js'

const pageName = 'submission-01-client-details'
const nextPageName = 'submission-02-species'
const clientFieldNames = [
  'cph',
  'name',
  'farmName',
  'addressLine1',
  'addressLine2',
  'addressLine3',
  'county',
  'postcode'
]

const submissionClientSchema = Joi.object({
  intent: Joi.string().valid('edit', 'new', 'cancel').optional(),
  clientId: Joi.string().allow('').optional(),
  ...Object.fromEntries(clientFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()])),
  animalsAtClientAddress: Joi.string().valid('yes', 'no').optional(),
  animalAddress: Joi.string().allow('').optional()
})

const getClientLabel = (client) => [
  client.name,
  client.addressLine1,
  client.addressLine2,
  client.addressLine3,
  client.county,
  client.postcode,
  client.cph
].filter(Boolean).join(', ')

const getClientOptions = (clients, selectedClientId) => [
  { value: '', text: 'Select a client', selected: !selectedClientId },
  ...clients.map((client) => ({
    value: client.clientId,
    text: getClientLabel(client),
    selected: client.clientId === selectedClientId
  }))
]

const getClientFieldValues = (client = {}) => Object.fromEntries(
  clientFieldNames.map((fieldName) => [fieldName, client[fieldName] || ''])
)

const getClientDetailsViewContext = (submissionFormState, clients, overrides = {}) => {
  const savedDetails = submissionFormState.formData?.clientDetails || {}
  const selectedClientId = overrides.selectedClientId ?? savedDetails.clientId ?? ''
  const selectedClient = clients.find((client) => client.clientId === selectedClientId)
  const selectedClientLabel = selectedClient ? getClientLabel(selectedClient) : ''
  const savedDetailsForSelection = savedDetails.clientId === selectedClientId ? savedDetails : {}
  const isManualEntry = !savedDetails.clientId &&
    clientFieldNames.some((fieldName) => Object.hasOwn(savedDetails, fieldName))
  const selectedClientDetails = selectedClient
    ? { ...getClientFieldValues(selectedClient), ...savedDetailsForSelection }
    : savedDetails

  return {
    clientOptions: getClientOptions(clients, selectedClientId),
    animalsAtClientAddress: savedDetails.animalsAtClientAddress,
    animalAddress: savedDetails.animalAddress || '',
    selectedClientName: selectedClientLabel,
    selectedClient: selectedClient
      ? {
          ...selectedClientDetails,
          address: [
            selectedClientDetails.addressLine1,
            selectedClientDetails.addressLine2,
            selectedClientDetails.addressLine3
          ].filter(Boolean).join(', ')
        }
      : undefined,
    clientDetails: overrides.clientDetails || selectedClientDetails,
    editMode: isManualEntry,
    ...overrides,
    submissionFormState
  }
}

const loadClients = async () => {
  try {
    return await getClients()
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
    return []
  }
}

const renderClientDetailsPage = (h, submissionFormState, clients, overrides = {}) =>
  h.view('select-client.njk', getClientDetailsViewContext(submissionFormState, clients, overrides))

const buildClientDetails = (payload, client) => {
  const submittedFields = clientFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))
  const details = submittedFields
    ? getClientFieldValues(payload)
    : getClientFieldValues(client)

  return {
    ...(client && { clientId: client.clientId }),
    ...Object.fromEntries(
      clientFieldNames.map((fieldName) => [fieldName, String(details[fieldName] || '').trim()])
    ),
    ...(payload.animalsAtClientAddress && { animalsAtClientAddress: payload.animalsAtClientAddress }),
    ...(payload.animalsAtClientAddress === 'no' && payload.animalAddress?.trim() && {
      animalAddress: payload.animalAddress.trim()
    })
  }
}

const selectClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const clients = await loadClients()

        return renderClientDetailsPage(h, submissionFormState, clients)
      }
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      options: {
        validate: {
          payload: submissionClientSchema
        }
      },
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const formData = submissionFormState.formData || {}
        const clients = await loadClients()
        const selectedClient = clients.find((client) => client.clientId === request.payload.clientId)
        const { intent } = request.payload
        const animalLocation = {
          animalsAtClientAddress: request.payload.animalsAtClientAddress ??
            formData.clientDetails?.animalsAtClientAddress,
          animalAddress: request.payload.animalAddress ??
            formData.clientDetails?.animalAddress ?? ''
        }

        if (intent === 'edit' && selectedClient) {
          const savedDetails = formData.clientDetails
          const clientDetails = savedDetails?.clientId === selectedClient.clientId
            ? { ...getClientFieldValues(selectedClient), ...savedDetails }
            : getClientFieldValues(selectedClient)

          return renderClientDetailsPage(h, submissionFormState, clients, {
            clientDetails: { ...clientDetails, clientId: selectedClient.clientId },
            editMode: true,
            ...animalLocation
          })
        }

        if (intent === 'new') {
          return renderClientDetailsPage(h, submissionFormState, clients, {
            clientDetails: getClientFieldValues(),
            editMode: true,
            ...animalLocation
          })
        }

        if (intent === 'cancel') {
          return renderClientDetailsPage(h, submissionFormState, clients, {
            selectedClientId: selectedClient?.clientId || '',
            editMode: false,
            ...animalLocation
          })
        }

        const hasSubmittedClientFields = clientFieldNames.some((fieldName) =>
          Object.hasOwn(request.payload, fieldName)
        )

        if (request.payload.clientId && !selectedClient) {
          return renderClientDetailsPage(h, submissionFormState, clients, {
            selectedClientId: '',
            selectionError: 'Select a client from the list, or enter client details manually.'
          }).code(400)
        }

        if (!selectedClient && !hasSubmittedClientFields) {
          return renderClientDetailsPage(h, submissionFormState, clients, {
            selectionError: 'Select a client from the list, or enter client details manually.'
          }).code(400)
        }

        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: {
            ...formData,
            clientDetails: buildClientDetails(request.payload, selectedClient)
          }
        })
        request.yar.touch()

        return h.redirect(`/${nextPageName}`)
      }
    }
  ])
}

export default selectClient
