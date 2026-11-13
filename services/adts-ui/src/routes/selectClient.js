import Joi from 'joi'
import { BAD_REQUEST_STATUS } from './submissionViewHelpers.js'
import {
  animalAddressFieldNames,
  animalAddressPageName,
  clientAddressPageName,
  clientFieldNames,
  getClientIntentViewOptions,
  getAnimalAddressFieldValues,
  getClientFieldValues,
  getClientLabel,
  getSelectedClientDetails,
  isManualClientEntry,
  loadClients,
  loadCounties,
  pageName,
  renderClientDetailsPage
} from './selectClientView.js'

const nextPageName = 'submission-02-species'
export const CPH_ERROR = 'Enter a CPH number in the format XX/XXX/XXXX'
export const CPH_PATTERN = /^\d{2}\/\d{3}\/\d{4}$/

export const submissionClientSchema = Joi.object({
  intent: Joi.string().valid('edit', 'new', 'cancel', 'newClientAddress', 'newAnimalAddress', 'editAnimalAddress', 'cancelAnimalAddress').optional(),
  clientId: Joi.string().allow('').optional(),
  animalAddressClientId: Joi.string().allow('').optional(),
  manualClientEntry: Joi.string().valid('yes').optional(),
  ...Object.fromEntries(clientFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()])),
  ...Object.fromEntries(animalAddressFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()])),
  animalsAtClientAddress: Joi.string().valid('yes', 'no').optional(),
  animalAddress: Joi.string().allow('').optional()
})

const getCphErrors = (payload) => {
  const errors = {}
  const clientCph = payload.cph?.trim()
  const animalAddressCph = payload.animalAddressCph?.trim()

  if (clientCph && !CPH_PATTERN.test(clientCph)) {
    errors.cph = CPH_ERROR
  }

  if (animalAddressCph && !CPH_PATTERN.test(animalAddressCph)) {
    errors.animalAddressCph = CPH_ERROR
  }

  return errors
}

const renderCphValidationErrors = (
  h,
  submissionFormState,
  clients,
  counties,
  payload,
  selectedClient,
  errors
) => {
  const clientDetails = hasSubmittedClientFields(payload)
    ? {
        ...getClientFieldValues(payload),
        ...(selectedClient && { clientId: selectedClient.clientId })
      }
    : undefined
  const animalAddressDetails = animalAddressFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))
    ? getAnimalAddressFieldValues(payload)
    : undefined
  const errorList = Object.entries(errors).map(([fieldName, text]) => ({
    text,
    href: `#${fieldName}`
  }))

  return renderClientDetailsPage(h, submissionFormState, clients, counties, {
    ...(clientDetails && { clientDetails, editMode: true }),
    ...(animalAddressDetails && { animalAddressDetails }),
    selectedClientId: selectedClient?.clientId || '',
    animalAddressClientId: payload.animalAddressClientId || '',
    errors,
    errorList
  }).code(BAD_REQUEST_STATUS)
}

const getClientDetailsForSubmission = (payload, client, savedClientDetails) => {
  if (hasSubmittedClientFields(payload)) {
    return getClientFieldValues(payload)
  }
  if (client) {
    return getSelectedClientDetails(savedClientDetails, client)
  }
  return getClientFieldValues(savedClientDetails)
}

const getAnimalAddressDetailsForSubmission = (payload, animalAddressClient, savedClientDetails) => {
  if (animalAddressFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))) {
    return getAnimalAddressFieldValues(payload)
  }
  if (animalAddressClient) {
    return getClientFieldValues(animalAddressClient)
  }
  return savedClientDetails.animalAddressDetails || getClientFieldValues()
}

const getAnimalAddressDetailsToSave = (payload, animalAddressClient, savedClientDetails) => {
  if (payload.animalsAtClientAddress !== 'no') {
    return {}
  }

  if (animalAddressClient) {
    return {
      animalAddressClientId: String(animalAddressClient.clientId),
      animalAddress: getClientLabel(animalAddressClient)
    }
  }

  const submittedAddress = payload.animalAddress?.trim()
  if (submittedAddress) {
    return { animalAddress: submittedAddress }
  }

  const savedAddress = savedClientDetails.animalAddress?.trim()
  if (savedAddress) {
    return { animalAddress: savedAddress }
  }

  return {}
}

const getSavedAnimalAddressDetails = (payload, animalAddressDetails) => {
  const hasDetails = clientFieldNames.some((fieldName) => animalAddressDetails[fieldName].trim())
  if (payload.animalsAtClientAddress !== 'no' || !hasDetails) {
    return {}
  }

  return {
    animalAddressDetails: Object.fromEntries(
      clientFieldNames.map((fieldName) => [fieldName, animalAddressDetails[fieldName].trim()])
    )
  }
}

const buildClientDetails = (payload, client, animalAddressClient, savedClientDetails = {}) => {
  const details = getClientDetailsForSubmission(payload, client, savedClientDetails)
  const animalAddressDetails = getAnimalAddressDetailsForSubmission(
    payload,
    animalAddressClient,
    savedClientDetails
  )

  return {
    ...(client && { clientId: client.clientId }),
    ...Object.fromEntries(
      clientFieldNames.map((fieldName) => [fieldName, String(details[fieldName] || '').trim()])
    ),
    ...(payload.animalsAtClientAddress && { animalsAtClientAddress: payload.animalsAtClientAddress }),
    ...getAnimalAddressDetailsToSave(payload, animalAddressClient, savedClientDetails),
    ...getSavedAnimalAddressDetails(payload, animalAddressDetails)
  }
}

const hasSubmittedClientFields = (payload) =>
  clientFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))

const getAnimalAddressDetailsForLocation = (payload, savedDetails, animalAddressClient) => {
  const hasSubmittedFields = animalAddressFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))
  if (hasSubmittedFields) {
    return getAnimalAddressFieldValues(payload)
  }
  return savedDetails.animalAddressDetails ||
    (animalAddressClient ? getClientFieldValues(animalAddressClient) : getClientFieldValues())
}

const getAnimalLocation = (payload, formData, animalAddressClient) => {
  const savedDetails = formData.clientDetails || {}

  return {
    animalsAtClientAddress: payload.animalsAtClientAddress ??
      savedDetails.animalsAtClientAddress,
    animalAddressClientId: payload.animalAddressClientId ??
      savedDetails.animalAddressClientId ?? '',
    animalAddress: payload.animalAddress ??
      savedDetails.animalAddress ?? '',
    animalAddressDetails: getAnimalAddressDetailsForLocation(payload, savedDetails, animalAddressClient)
  }
}

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

export const saveClientDraftForAnimalAddress = ({
  request,
  submissionFormStateKey,
  submissionFormState,
  formData,
  payload,
  selectedClient,
  selectedAnimalAddress,
  startNewAnimalAddress = false
}) => {
  const clientDetails = { ...getSubmittedClientDetails(payload, selectedClient, formData) }
  const animalLocation = selectedAnimalAddress
    ? {
        animalAddressClientId: String(selectedAnimalAddress.clientId),
        animalAddress: getClientLabel(selectedAnimalAddress)
      }
    : {}
  if (startNewAnimalAddress) {
    delete clientDetails.animalAddressClientId
    delete clientDetails.animalAddress
    delete clientDetails.animalAddressDetails
  }

  request.yar.set(submissionFormStateKey, {
    ...submissionFormState,
    formData: {
      ...formData,
      clientDetails: {
        ...clientDetails,
        animalsAtClientAddress: 'no',
        ...animalLocation
      }
    }
  })
  request.yar.touch()
}

export const saveClientDraftForAddress = (
  request,
  submissionFormStateKey,
  submissionFormState,
  formData,
  payload,
  selectedClient,
  selectedAnimalAddress
) => {
  const clientDetails = {
    ...getSubmittedClientDetails(payload, selectedClient, formData),
    ...(selectedClient && { clientId: selectedClient.clientId })
  }
  const animalLocation = getAnimalLocation(payload, formData, selectedAnimalAddress)

  request.yar.set(submissionFormStateKey, {
    ...submissionFormState,
    formData: {
      ...formData,
      clientDetails: { ...clientDetails, ...animalLocation }
    }
  })
  request.yar.touch()
}

export const animalAddressSchema = Joi.object({
  intent: Joi.string().valid('save', 'cancel').optional(),
  animalAddressClientId: Joi.string().allow('').optional(),
  ...Object.fromEntries(animalAddressFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()]))
})

export const clientAddressSchema = Joi.object({
  intent: Joi.string().valid('save', 'cancel').optional(),
  isEditing: Joi.string().valid('yes', 'no').optional(),
  ...Object.fromEntries(clientFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()]))
})

export const shouldShowClientSelectionError = (payload, selectedClient, hasSubmittedFields) =>
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

const renderClientSelectionError = (h, submissionFormState, clients, counties, payload, selectedClient) =>
  renderClientDetailsPage(
    h,
    submissionFormState,
    clients,
    counties,
    getClientSelectionErrorOptions(payload, selectedClient)
  ).code(BAD_REQUEST_STATUS)

const handleClientPostIntent = ({
  request,
  h,
  submissionFormStateKey,
  submissionFormState,
  formData,
  payload,
  clients,
  counties,
  selectedClient,
  selectedAnimalAddress
}) => {
  const savedClientDetails = formData.clientDetails || {}
  if (
    payload.intent === 'editAnimalAddress' &&
    (selectedAnimalAddress || savedClientDetails.animalAddressDetails)
  ) {
    saveClientDraftForAnimalAddress({
      request,
      submissionFormStateKey,
      submissionFormState,
      formData,
      payload,
      selectedClient,
      selectedAnimalAddress
    })
    const animalAddressClientId = selectedAnimalAddress
      ? `&animalAddressClientId=${selectedAnimalAddress.clientId}`
      : ''
    return h.redirect(`/${animalAddressPageName}?intent=edit${animalAddressClientId}`)
  }

  const hasSubmittedFields = hasSubmittedClientFields(payload) || isManualClientEntry(savedClientDetails)
  const intentViewOptions = getClientIntentViewOptions({
    intent: payload.intent,
    selectedClient,
    formData,
    submittedClientDetails: getSubmittedClientDetails(payload, selectedClient, formData),
    hasSubmittedFields,
    payload,
    animalLocation: getAnimalLocation(payload, formData, selectedAnimalAddress)
  })

  return intentViewOptions
    ? renderClientDetailsPage(h, submissionFormState, clients, counties, intentViewOptions)
    : undefined
}

const createPostHandler = (submissionFormStateKey) => async (request, h) => {
  const submissionFormState = request.yar.get(submissionFormStateKey) || {}
  const formData = submissionFormState.formData || {}
  const payload = request.payload
  if (payload.intent === 'new') {
    return h.redirect(`/${clientAddressPageName}?intent=new`)
  }

  const clients = await loadClients()
  const counties = await loadCounties()
  const selectedClient = clients.find((client) => client.clientId === payload.clientId)
  const selectedAnimalAddress = clients.find((client) =>
    String(client.clientId) === String(payload.animalAddressClientId)
  )
  const savedClientDetails = formData.clientDetails || {}
  const hasSubmittedFields = hasSubmittedClientFields(payload) || isManualClientEntry(savedClientDetails)
  const intentResponse = handleClientPostIntent({
    request,
    h,
    submissionFormStateKey,
    submissionFormState,
    formData,
    payload,
    clients,
    counties,
    selectedClient,
    selectedAnimalAddress
  })
  if (intentResponse) {
    return intentResponse
  }

  const cphErrors = getCphErrors(payload)
  if (Object.keys(cphErrors).length) {
    return renderCphValidationErrors(
      h,
      submissionFormState,
      clients,
      counties,
      payload,
      selectedClient,
      cphErrors
    )
  }

  if (shouldShowClientSelectionError(payload, selectedClient, hasSubmittedFields)) {
    return renderClientSelectionError(h, submissionFormState, clients, counties, payload, selectedClient)
  }

  request.yar.set(submissionFormStateKey, {
    ...submissionFormState,
    formData: {
      ...formData,
      clientDetails: buildClientDetails(payload, selectedClient, selectedAnimalAddress, savedClientDetails)
    }
  })
  request.yar.touch()

  return h.redirect(`/${nextPageName}`)
}

const getStartRoute = (submissionFormStateKey) => ({
  method: 'GET',
  path: `/${pageName}/start`,
  handler: (request, h) => {
    request.yar.set(submissionFormStateKey, {})
    request.yar.touch()
    return h.redirect(`/${pageName}`)
  }
})

const getClientDetailsRoute = (submissionFormStateKey) => ({
  method: 'GET',
  path: `/${pageName}`,
  handler: async (request, h) => {
    const submissionFormState = request.yar.get(submissionFormStateKey) || {}
    const clients = await loadClients()
    const counties = await loadCounties()
    const intent = request.query.intent
    if (intent === 'newAnimalAddress') {
      return h.redirect(`/${animalAddressPageName}?intent=new`)
    }
    if (intent === 'new') {
      return h.redirect(`/${clientAddressPageName}?intent=new`)
    }

    return renderClientDetailsPage(h, submissionFormState, clients, counties)
  }
})

const postClientDetailsRoute = (submissionFormStateKey) => ({
  method: 'POST',
  path: `/${pageName}`,
  options: {
    validate: {
      payload: submissionClientSchema
    }
  },
  handler: createPostHandler(submissionFormStateKey)
})

const selectClient = (server, submissionFormStateKey) => {
  server.route([
    getStartRoute(submissionFormStateKey),
    getClientDetailsRoute(submissionFormStateKey),
    postClientDetailsRoute(submissionFormStateKey)
  ])
}

export default selectClient
