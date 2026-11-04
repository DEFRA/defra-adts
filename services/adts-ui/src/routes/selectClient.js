import Joi from 'joi'
import { getClients } from '../backend/clients.js'
import { BAD_REQUEST_STATUS } from './submissionViewHelpers.js'

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
const animalAddressFieldNames = clientFieldNames.map((fieldName) =>
  `animalAddress${fieldName[0].toUpperCase()}${fieldName.slice(1)}`
)

const submissionClientSchema = Joi.object({
  intent: Joi.string().valid('edit', 'new', 'cancel', 'newAnimalAddress', 'cancelAnimalAddress').optional(),
  clientId: Joi.string().allow('').optional(),
  manualClientEntry: Joi.string().valid('yes').optional(),
  ...Object.fromEntries(clientFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()])),
  ...Object.fromEntries(animalAddressFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()])),
  animalsAtClientAddress: Joi.string().valid('yes', 'no').optional(),
  animalAddress: Joi.string().allow('').optional()
})

const getClientLabel = (client) => [
  client.name,
  client.farmName,
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

const getAnimalAddressFieldValues = (values = {}) => Object.fromEntries(
  clientFieldNames.map((fieldName) => {
    const animalAddressFieldName = `animalAddress${fieldName[0].toUpperCase()}${fieldName.slice(1)}`
    return [fieldName, values[animalAddressFieldName] || '']
  })
)

const isManualClientEntry = (savedDetails) =>
  !savedDetails.clientId &&
  clientFieldNames.some((fieldName) => Object.hasOwn(savedDetails, fieldName))

const getSelectedClientDetails = (savedDetails, selectedClient) => {
  if (!selectedClient) {
    return savedDetails
  }

  const savedDetailsForSelection = savedDetails.clientId === selectedClient.clientId
    ? savedDetails
    : {}

  return { ...getClientFieldValues(selectedClient), ...savedDetailsForSelection }
}

const getClientAddress = (clientDetails) => [
  clientDetails.addressLine1,
  clientDetails.addressLine2,
  clientDetails.addressLine3
].filter(Boolean).join(', ')

const getClientDetailsViewContext = (submissionFormState, clients, overrides = {}) => {
  const savedDetails = submissionFormState.formData?.clientDetails || {}
  const selectedClientId = overrides.selectedClientId ?? savedDetails.clientId ?? ''
  const selectedClient = clients.find((client) => client.clientId === selectedClientId)
  const selectedClientDetails = getSelectedClientDetails(savedDetails, selectedClient)

  return {
    clientOptions: getClientOptions(clients, selectedClientId),
    animalsAtClientAddress: savedDetails.animalsAtClientAddress,
    animalAddress: savedDetails.animalAddress || '',
    animalAddressDetails: savedDetails.animalAddressDetails || getClientFieldValues(),
    animalAddressEditMode: Boolean(savedDetails.animalAddressDetails),
    selectedClientName: getClientLabel(selectedClient || {}),
    selectedClient: selectedClient
      ? {
          ...selectedClientDetails,
          address: getClientAddress(selectedClientDetails)
        }
      : undefined,
    clientDetails: overrides.clientDetails || selectedClientDetails,
    editMode: isManualClientEntry(savedDetails),
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
  const animalAddressDetails = getAnimalAddressFieldValues(payload)
  const hasAnimalAddressDetails = clientFieldNames.some((fieldName) =>
    animalAddressDetails[fieldName].trim()
  )

  return {
    ...(client && { clientId: client.clientId }),
    ...Object.fromEntries(
      clientFieldNames.map((fieldName) => [fieldName, String(details[fieldName] || '').trim()])
    ),
    ...(payload.animalsAtClientAddress && { animalsAtClientAddress: payload.animalsAtClientAddress }),
    ...(payload.animalsAtClientAddress === 'no' && payload.animalAddress?.trim() && {
      animalAddress: payload.animalAddress.trim()
    }),
    ...(payload.animalsAtClientAddress === 'no' && hasAnimalAddressDetails && {
      animalAddressDetails: Object.fromEntries(
        clientFieldNames.map((fieldName) => [fieldName, animalAddressDetails[fieldName].trim()])
      )
    })
  }
}

const hasSubmittedClientFields = (payload) =>
  clientFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))

const getAnimalLocation = (payload, formData, intent) => ({
  animalsAtClientAddress: payload.animalsAtClientAddress ??
    formData.clientDetails?.animalsAtClientAddress,
  animalAddress: payload.animalAddress ??
    formData.clientDetails?.animalAddress ?? '',
  animalAddressDetails: getAnimalAddressFieldValues(payload),
  animalAddressEditMode: intent === 'newAnimalAddress' ||
    (intent !== 'cancelAnimalAddress' && Boolean(formData.clientDetails?.animalAddressDetails))
})

const getSubmittedClientDetails = (payload, selectedClient, formData) => {
  if (hasSubmittedClientFields(payload)) {
    return {
      ...getClientFieldValues(payload),
      ...(selectedClient && { clientId: selectedClient.clientId })
    }
  }

  if (!selectedClient) {
    return formData.clientDetails || getClientFieldValues()
  }

  const savedDetails = formData.clientDetails
  if (savedDetails?.clientId !== selectedClient.clientId) {
    return getClientFieldValues(selectedClient)
  }

  return { ...getClientFieldValues(selectedClient), ...savedDetails }
}

const getClientIntentViewOptions = ({
  intent,
  selectedClient,
  formData,
  submittedClientDetails,
  hasSubmittedFields,
  payload,
  animalLocation
}) => {
  if (intent === 'edit' && selectedClient) {
    const clientDetails = getSelectedClientDetails(formData.clientDetails || {}, selectedClient)
    return {
      clientDetails: { ...clientDetails, clientId: selectedClient.clientId },
      editMode: true,
      ...animalLocation
    }
  }

  if (intent === 'new') {
    return {
      clientDetails: getClientFieldValues(),
      editMode: true,
      ...animalLocation
    }
  }

  if (intent === 'newAnimalAddress' || intent === 'cancelAnimalAddress') {
    return {
      clientDetails: submittedClientDetails,
      editMode: hasSubmittedFields || payload.manualClientEntry === 'yes',
      ...animalLocation
    }
  }

  if (intent === 'cancel') {
    return {
      selectedClientId: selectedClient?.clientId || '',
      editMode: false,
      ...animalLocation
    }
  }
}

const shouldShowClientSelectionError = (payload, selectedClient, hasSubmittedFields) =>
  Boolean(payload.clientId && !selectedClient) ||
  (!selectedClient && !hasSubmittedFields)

const getClientSelectionErrorOptions = (payload, selectedClient) => {
  const options = {
    selectionError: 'Select a client from the list, or enter client details manually.'
  }

  if (payload.clientId && !selectedClient) {
    options.selectedClientId = ''
  }

  return options
}

const renderClientSelectionError = (h, submissionFormState, clients, payload, selectedClient) =>
  renderClientDetailsPage(
    h,
    submissionFormState,
    clients,
    getClientSelectionErrorOptions(payload, selectedClient)
  ).code(BAD_REQUEST_STATUS)

const createPostHandler = (submissionFormStateKey) => async (request, h) => {
  const submissionFormState = request.yar.get(submissionFormStateKey) || {}
  const formData = submissionFormState.formData || {}
  const clients = await loadClients()
  const payload = request.payload
  const selectedClient = clients.find((client) => client.clientId === payload.clientId)
  const hasSubmittedFields = hasSubmittedClientFields(payload)
  const submittedClientDetails = getSubmittedClientDetails(payload, selectedClient, formData)
  const animalLocation = getAnimalLocation(payload, formData, payload.intent)
  const intentViewOptions = getClientIntentViewOptions({
    intent: payload.intent,
    selectedClient,
    formData,
    submittedClientDetails,
    hasSubmittedFields,
    payload,
    animalLocation
  })

  if (intentViewOptions) {
    return renderClientDetailsPage(h, submissionFormState, clients, intentViewOptions)
  }

  if (shouldShowClientSelectionError(payload, selectedClient, hasSubmittedFields)) {
    return renderClientSelectionError(h, submissionFormState, clients, payload, selectedClient)
  }

  request.yar.set(submissionFormStateKey, {
    ...submissionFormState,
    formData: {
      ...formData,
      clientDetails: buildClientDetails(payload, selectedClient)
    }
  })
  request.yar.touch()

  return h.redirect(`/${nextPageName}`)
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
      handler: createPostHandler(submissionFormStateKey)
    }
  ])
}

export default selectClient
