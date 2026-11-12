import { getClients } from '../backend/clients.js'
import { getCounties } from '../backend/counties.js'

export const pageName = 'submission-01-client-details'
export const clientAddressPageName = 'submission-01-client-address'
export const animalAddressPageName = 'submission-01-animal-address'

export const clientFieldNames = [
  'cph',
  'name',
  'farmName',
  'addressLine1',
  'addressLine2',
  'addressLine3',
  'county',
  'postcode'
]

export const animalAddressFieldNames = clientFieldNames.map((fieldName) =>
  `animalAddress${fieldName[0].toUpperCase()}${fieldName.slice(1)}`
)

export const getClientLabel = (client) => [
  client.name,
  client.farmName,
  client.addressLine1,
  client.addressLine2,
  client.addressLine3,
  client.county,
  client.postcode,
  client.cph
].filter(Boolean).join(', ')

const getClientOptions = (clients, selectedClientId, placeholder = 'Select a client') => [
  { value: '', text: placeholder, selected: !selectedClientId },
  ...clients.map((client) => ({
    value: client.clientId,
    text: getClientLabel(client),
    selected: String(client.clientId) === String(selectedClientId)
  }))
]

export const getClientFieldValues = (client = {}) => Object.fromEntries(
  clientFieldNames.map((fieldName) => [fieldName, client[fieldName] || ''])
)

export const getAnimalAddressFieldValues = (values = {}) => Object.fromEntries(
  clientFieldNames.map((fieldName) => {
    const animalAddressFieldName = `animalAddress${fieldName[0].toUpperCase()}${fieldName.slice(1)}`
    return [fieldName, values[animalAddressFieldName] || '']
  })
)

export const isManualClientEntry = (savedDetails) =>
  !savedDetails.clientId &&
  clientFieldNames.some((fieldName) => Boolean(savedDetails[fieldName]))

export const getSelectedClientDetails = (savedDetails, selectedClient) => {
  if (!selectedClient) {
    return savedDetails
  }

  const savedDetailsForSelection = savedDetails.clientId === selectedClient.clientId
    ? savedDetails
    : {}

  return { ...getClientFieldValues(selectedClient), ...savedDetailsForSelection }
}

export const getClientIntentViewOptions = ({
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

  if (intent === 'cancelAnimalAddress') {
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

  return null
}

const getCountyOptions = (counties, selectedCounty) => {
  const names = counties.map((county) => county.name)
  const extraOption = selectedCounty && !names.includes(selectedCounty) ? [selectedCounty] : []

  return [
    { value: '', text: 'Select a county', selected: !selectedCounty },
    ...[...names, ...extraOption].map((name) => ({
      value: name,
      text: name,
      selected: name === selectedCounty
    }))
  ]
}

const getSelectedClientContext = (savedDetails, selectedClient) => {
  const selectedClientDetails = getSelectedClientDetails(savedDetails, selectedClient)
  const hasManualClient = !savedDetails.clientId &&
    clientFieldNames.some((fieldName) => Boolean(savedDetails[fieldName]))

  return {
    selectedClientName: getClientLabel(selectedClient || (hasManualClient ? savedDetails : {})),
    hasSelectedClient: Boolean(selectedClient),
    hasManualClient,
    clientDetails: selectedClientDetails,
    editMode: isManualClientEntry(savedDetails) && !hasManualClient
  }
}

const getClientDetailsViewContext = (submissionFormState, clients, counties, overrides = {}) => {
  const savedDetails = submissionFormState.formData?.clientDetails || {}
  const selectedClientId = overrides.selectedClientId ?? savedDetails.clientId ?? ''
  const selectedClient = clients.find((client) => client.clientId === selectedClientId)
  const animalAddressClientId = overrides.animalAddressClientId ?? savedDetails.animalAddressClientId ?? ''
  const selectedAnimalAddressRecord = clients.find((client) =>
    String(client.clientId) === String(animalAddressClientId)
  )
  const savedAnimalAddress = savedDetails.animalAddressDetails
  const animalAddressDetails = savedAnimalAddress ||
    (selectedAnimalAddressRecord ? getClientFieldValues(selectedAnimalAddressRecord) : getClientFieldValues())

  const viewContext = {
    errors: {},
    errorList: [],
    clientOptions: getClientOptions(clients, selectedClientId),
    animalAddressOptions: getClientOptions(clients, animalAddressClientId, 'Select an animal address'),
    animalAddressClientId,
    animalsAtClientAddress: savedDetails.animalsAtClientAddress,
    animalAddress: savedDetails.animalAddress || '',
    animalAddressDetails,
    animalAddressEditMode: !savedDetails.animalAddressClientId && Boolean(savedAnimalAddress),
    selectedAnimalAddressName: getClientLabel(savedAnimalAddress || selectedAnimalAddressRecord || {}),
    hasSelectedAnimalAddress: Boolean(savedAnimalAddress || selectedAnimalAddressRecord),
    ...getSelectedClientContext(savedDetails, selectedClient),
    ...overrides,
    submissionFormState
  }

  return {
    ...viewContext,
    countyOptions: getCountyOptions(counties, viewContext.clientDetails?.county),
    animalAddressCountyOptions: getCountyOptions(counties, viewContext.animalAddressDetails?.county)
  }
}

export const loadClients = async () => {
  try {
    return await getClients()
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
    return []
  }
}

export const loadCounties = async () => {
  try {
    return await getCounties()
  } catch (error) {
    console.error('Error loading counties:', error.message)
    return []
  }
}

export const renderClientDetailsPage = (h, submissionFormState, clients, counties, overrides = {}) =>
  h.view('select-client.njk', getClientDetailsViewContext(submissionFormState, clients, counties, overrides))

export const renderAnimalAddressPage = (h, submissionFormState, counties, animalAddressDetails, options = {}) => {
  const errorList = Object.entries(options.errors || {}).map(([fieldName, text]) => ({
    text,
    href: `#${fieldName}`
  }))

  return h.view('animal-address.njk', {
    submissionFormState,
    animalAddressDetails,
    animalAddressClientId: options.animalAddressClientId || '',
    animalAddressCountyOptions: getCountyOptions(counties, animalAddressDetails.county),
    isEditing: options.isEditing,
    errors: options.errors || {},
    errorList
  })
}

export const renderClientAddressPage = (
  h,
  submissionFormState,
  counties,
  clientDetails,
  isEditing = false,
  errors = {}
) => {
  const errorList = Object.entries(errors).map(([fieldName, text]) => ({
    text,
    href: `#${fieldName}`
  }))

  return h.view('client-address.njk', {
    submissionFormState,
    clientDetails,
    isEditing,
    countyOptions: getCountyOptions(counties, clientDetails.county),
    errors,
    errorList
  })
}
