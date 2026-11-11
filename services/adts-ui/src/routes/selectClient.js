import Joi from 'joi'
import { getClients } from '../backend/clients.js'
import { getCounties } from '../backend/counties.js'
import { BAD_REQUEST_STATUS } from './submissionViewHelpers.js'

const pageName = 'submission-01-client-details'
const clientAddressPageName = 'submission-01-client-address'
const animalAddressPageName = 'submission-01-animal-address'
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
const CPH_ERROR = 'Enter a CPH number in the format XX/XXX/XXXX'
const CPH_PATTERN = /^\d{2}\/\d{3}\/\d{4}$/

const submissionClientSchema = Joi.object({
  intent: Joi.string().valid('edit', 'new', 'cancel', 'newClientAddress', 'newAnimalAddress', 'editAnimalAddress', 'cancelAnimalAddress').optional(),
  clientId: Joi.string().allow('').optional(),
  animalAddressClientId: Joi.string().allow('').optional(),
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

const getClientOptions = (clients, selectedClientId, placeholder = 'Select a client') => [
  { value: '', text: placeholder, selected: !selectedClientId },
  ...clients.map((client) => ({
    value: client.clientId,
    text: getClientLabel(client),
    selected: String(client.clientId) === String(selectedClientId)
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
  clientFieldNames.some((fieldName) => Boolean(savedDetails[fieldName]))

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

// A saved county missing from the reference data is kept so it isn't silently dropped on revisit.
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

const getClientDetailsViewContext = (submissionFormState, clients, counties, overrides = {}) => {
  const savedDetails = submissionFormState.formData?.clientDetails || {}
  const selectedClientId = overrides.selectedClientId ?? savedDetails.clientId ?? ''
  const selectedClient = clients.find((client) => client.clientId === selectedClientId)
  const animalAddressClientId = overrides.animalAddressClientId ?? savedDetails.animalAddressClientId ?? ''
  const selectedAnimalAddressRecord = clients.find((client) =>
    String(client.clientId) === String(animalAddressClientId)
  )
  const selectedClientDetails = getSelectedClientDetails(savedDetails, selectedClient)
  const isManualClient = !savedDetails.clientId &&
    clientFieldNames.some((fieldName) => Boolean(savedDetails[fieldName]))
  const animalAddressDetails = savedDetails.animalAddressDetails ||
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
    animalAddressEditMode: !savedDetails.animalAddressClientId &&
      Boolean(savedDetails.animalAddressDetails),
    selectedAnimalAddressName: getClientLabel(
      savedDetails.animalAddressDetails || selectedAnimalAddressRecord || {}
    ),
    selectedAnimalAddress: (savedDetails.animalAddressDetails || selectedAnimalAddressRecord)
      ? {
          ...(savedDetails.animalAddressDetails || getClientFieldValues(selectedAnimalAddressRecord)),
          address: getClientAddress(savedDetails.animalAddressDetails || getClientFieldValues(selectedAnimalAddressRecord))
        }
      : undefined,
    selectedClientName: getClientLabel(selectedClient || {}),
    selectedClient: selectedClient
      ? {
          ...selectedClientDetails,
          address: getClientAddress(selectedClientDetails)
        }
      : undefined,
    manualClient: isManualClient
      ? {
          ...selectedClientDetails,
          address: getClientAddress(selectedClientDetails)
        }
      : undefined,
    clientDetails: overrides.clientDetails || selectedClientDetails,
    editMode: overrides.editMode ?? (isManualClientEntry(savedDetails) && !isManualClient),
    ...overrides,
    submissionFormState
  }

  return {
    ...viewContext,
    countyOptions: getCountyOptions(counties, viewContext.clientDetails?.county),
    animalAddressCountyOptions: getCountyOptions(counties, viewContext.animalAddressDetails?.county)
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

const loadCounties = async () => {
  try {
    return await getCounties()
  } catch (error) {
    console.error('Error loading counties:', error.message)
    return []
  }
}

const renderClientDetailsPage = (h, submissionFormState, clients, counties, overrides = {}) =>
  h.view('select-client.njk', getClientDetailsViewContext(submissionFormState, clients, counties, overrides))

const renderAnimalAddressPage = (h, submissionFormState, counties, animalAddressDetails, options = {}) => {
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

const renderClientAddressPage = (
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
    ...(animalAddressDetails && { animalAddressDetails, animalAddressEditMode: true }),
    selectedClientId: selectedClient?.clientId || '',
    animalAddressClientId: payload.animalAddressClientId || '',
    errors,
    errorList
  }).code(BAD_REQUEST_STATUS)
}

const buildClientDetails = (payload, client, animalAddressClient, savedClientDetails = {}) => {
  const submittedFields = clientFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))
  const details = submittedFields
    ? getClientFieldValues(payload)
    : client
      ? getSelectedClientDetails(savedClientDetails, client)
      : getClientFieldValues(savedClientDetails)
  const submittedAnimalAddressFields = animalAddressFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))
  const animalAddressDetails = submittedAnimalAddressFields
    ? getAnimalAddressFieldValues(payload)
    : animalAddressClient
      ? getClientFieldValues(animalAddressClient)
      : savedClientDetails.animalAddressDetails || getClientFieldValues()
  const hasAnimalAddressDetails = clientFieldNames.some((fieldName) =>
    animalAddressDetails[fieldName].trim()
  )

  return {
    ...(client && { clientId: client.clientId }),
    ...Object.fromEntries(
      clientFieldNames.map((fieldName) => [fieldName, String(details[fieldName] || '').trim()])
    ),
    ...(payload.animalsAtClientAddress && { animalsAtClientAddress: payload.animalsAtClientAddress }),
    ...(payload.animalsAtClientAddress === 'no' && animalAddressClient && {
      animalAddressClientId: String(animalAddressClient.clientId),
      animalAddress: getClientLabel(animalAddressClient)
    }),
    ...(payload.animalsAtClientAddress === 'no' && !animalAddressClient && payload.animalAddress?.trim() && {
      animalAddress: payload.animalAddress.trim()
    }),
    ...(payload.animalsAtClientAddress === 'no' && !animalAddressClient &&
      !payload.animalAddress?.trim() && savedClientDetails.animalAddress?.trim() && {
      animalAddress: savedClientDetails.animalAddress.trim()
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

const getAnimalLocation = (payload, formData, intent, animalAddressClient) => {
  const savedDetails = formData.clientDetails || {}
  const submittedAnimalAddressFields = animalAddressFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))
  const animalAddressDetails = submittedAnimalAddressFields
    ? getAnimalAddressFieldValues(payload)
    : savedDetails.animalAddressDetails ||
      (animalAddressClient ? getClientFieldValues(animalAddressClient) : getClientFieldValues())

  return {
    animalsAtClientAddress: payload.animalsAtClientAddress ??
      savedDetails.animalsAtClientAddress,
    animalAddressClientId: payload.animalAddressClientId ??
      savedDetails.animalAddressClientId ?? '',
    animalAddress: payload.animalAddress ??
      savedDetails.animalAddress ?? '',
    animalAddressDetails,
    animalAddressEditMode: intent === 'newAnimalAddress' ||
      intent === 'editAnimalAddress' ||
      (intent !== 'cancelAnimalAddress' && Boolean(savedDetails.animalAddressDetails))
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

const saveClientDraftForAnimalAddress = (
  request,
  submissionFormStateKey,
  submissionFormState,
  formData,
  payload,
  selectedClient,
  selectedAnimalAddress,
  startNewAnimalAddress = false
) => {
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

const saveClientDraftForAddress = (
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
  const animalLocation = getAnimalLocation(payload, formData, payload.intent, selectedAnimalAddress)
  delete animalLocation.animalAddressEditMode

  request.yar.set(submissionFormStateKey, {
    ...submissionFormState,
    formData: {
      ...formData,
      clientDetails: { ...clientDetails, ...animalLocation }
    }
  })
  request.yar.touch()
}

const animalAddressSchema = Joi.object({
  intent: Joi.string().valid('save', 'cancel').optional(),
  animalAddressClientId: Joi.string().allow('').optional(),
  ...Object.fromEntries(animalAddressFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()]))
})

const clientAddressSchema = Joi.object({
  intent: Joi.string().valid('save', 'cancel').optional(),
  isEditing: Joi.string().valid('yes', 'no').optional(),
  ...Object.fromEntries(clientFieldNames.map((fieldName) => [fieldName, Joi.string().allow('').optional()]))
})

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

const renderClientSelectionError = (h, submissionFormState, clients, counties, payload, selectedClient) =>
  renderClientDetailsPage(
    h,
    submissionFormState,
    clients,
    counties,
    getClientSelectionErrorOptions(payload, selectedClient)
  ).code(BAD_REQUEST_STATUS)

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
  if (payload.intent === 'editAnimalAddress' && selectedAnimalAddress) {
    saveClientDraftForAnimalAddress(
      request,
      submissionFormStateKey,
      submissionFormState,
      formData,
      payload,
      selectedClient,
      selectedAnimalAddress
    )
    return h.redirect(`/${animalAddressPageName}?intent=edit&animalAddressClientId=${selectedAnimalAddress.clientId}`)
  }

  const savedClientDetails = formData.clientDetails || {}
  const hasSubmittedFields = hasSubmittedClientFields(payload) || isManualClientEntry(savedClientDetails)
  const submittedClientDetails = getSubmittedClientDetails(payload, selectedClient, formData)
  const animalLocation = getAnimalLocation(payload, formData, payload.intent, selectedAnimalAddress)
  const intentViewOptions = getClientIntentViewOptions({
    intent: payload.intent,
    selectedClient,
    selectedAnimalAddress,
    formData,
    submittedClientDetails,
    hasSubmittedFields,
    payload,
    animalLocation
  })

  if (intentViewOptions) {
    return renderClientDetailsPage(h, submissionFormState, clients, counties, intentViewOptions)
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

const selectClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}/start`,
      handler: (request, h) => {
        request.yar.set(submissionFormStateKey, {})
        request.yar.touch()
        return h.redirect(`/${pageName}`)
      }
    },
    {
      method: 'GET',
      path: `/${clientAddressPageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const savedDetails = submissionFormState.formData?.clientDetails || {}
        const isEditing = request.query.intent === 'edit'
        const clientDetails = isEditing ? getClientFieldValues(savedDetails) : getClientFieldValues()
        const counties = await loadCounties()

        return renderClientAddressPage(h, submissionFormState, counties, clientDetails, isEditing)
      }
    },
    {
      method: 'POST',
      path: `/${clientAddressPageName}/start`,
      options: {
        validate: { payload: submissionClientSchema }
      },
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const formData = submissionFormState.formData || {}
        const payload = request.payload
        const clients = await loadClients()
        const selectedClient = clients.find((client) => String(client.clientId) === String(payload.clientId))
        const selectedAnimalAddress = clients.find((client) =>
          String(client.clientId) === String(payload.animalAddressClientId)
        )

        saveClientDraftForAddress(
          request,
          submissionFormStateKey,
          submissionFormState,
          formData,
          payload,
          selectedClient,
          selectedAnimalAddress
        )
        return h.redirect(`/${clientAddressPageName}?intent=new`)
      }
    },
    {
      method: 'POST',
      path: `/${clientAddressPageName}`,
      options: {
        validate: { payload: clientAddressSchema }
      },
      handler: async (request, h) => {
        if (request.payload.intent === 'cancel') {
          return h.redirect(`/${pageName}`)
        }

        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const formData = submissionFormState.formData || {}
        const clientDetails = getClientFieldValues(request.payload)
        const errors = {}
        if (clientDetails.cph.trim() && !CPH_PATTERN.test(clientDetails.cph.trim())) {
          errors.cph = CPH_ERROR
        }

        if (Object.keys(errors).length) {
          const counties = await loadCounties()
          return renderClientAddressPage(
            h,
            submissionFormState,
            counties,
            clientDetails,
            request.payload.isEditing === 'yes',
            errors
          ).code(BAD_REQUEST_STATUS)
        }

        const savedClientDetails = {
          ...formData.clientDetails,
          ...Object.fromEntries(
            clientFieldNames.map((fieldName) => [fieldName, clientDetails[fieldName].trim()])
          )
        }
        delete savedClientDetails.clientId

        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: {
            ...formData,
            clientDetails: savedClientDetails
          }
        })
        request.yar.touch()
        return h.redirect(`/${pageName}`)
      }
    },
    {
      method: 'GET',
      path: `/${animalAddressPageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const savedDetails = submissionFormState.formData?.clientDetails || {}
        const clients = await loadClients()
        const counties = await loadCounties()
        const animalAddressClientId = request.query.animalAddressClientId || savedDetails.animalAddressClientId || ''
        const selectedAnimalAddress = clients.find((client) =>
          String(client.clientId) === String(animalAddressClientId)
        )
        const isEditing = request.query.intent === 'edit'
        const animalAddressDetails = isEditing
          ? savedDetails.animalAddressDetails || getClientFieldValues(selectedAnimalAddress)
          : getClientFieldValues()

        return renderAnimalAddressPage(h, submissionFormState, counties, animalAddressDetails, {
          animalAddressClientId,
          isEditing
        })
      }
    },
    {
      method: 'POST',
      path: `/${animalAddressPageName}/start`,
      options: {
        validate: { payload: submissionClientSchema }
      },
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const formData = submissionFormState.formData || {}
        const payload = request.payload
        const clients = await loadClients()
        const selectedClient = clients.find((client) => String(client.clientId) === String(payload.clientId))
        const selectedAnimalAddress = clients.find((client) =>
          String(client.clientId) === String(payload.animalAddressClientId)
        )

        saveClientDraftForAnimalAddress(
          request,
          submissionFormStateKey,
          submissionFormState,
          formData,
          payload,
          selectedClient,
          selectedAnimalAddress,
          true
        )
        return h.redirect(`/${animalAddressPageName}?intent=new`)
      }
    },
    {
      method: 'POST',
      path: `/${animalAddressPageName}`,
      options: {
        validate: { payload: animalAddressSchema }
      },
      handler: async (request, h) => {
        if (request.payload.intent === 'cancel') {
          return h.redirect(`/${pageName}`)
        }

        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const formData = submissionFormState.formData || {}
        const details = getAnimalAddressFieldValues(request.payload)
        const errors = {}
        if (details.cph.trim() && !CPH_PATTERN.test(details.cph.trim())) {
          errors.animalAddressCph = CPH_ERROR
        }

        if (Object.keys(errors).length) {
          const counties = await loadCounties()
          return renderAnimalAddressPage(h, submissionFormState, counties, details, {
            animalAddressClientId: request.payload.animalAddressClientId,
            isEditing: Boolean(request.payload.animalAddressClientId),
            errors
          }).code(BAD_REQUEST_STATUS)
        }

        const animalAddressDetails = Object.fromEntries(
          clientFieldNames.map((fieldName) => [fieldName, details[fieldName].trim()])
        )
        const animalAddressClientId = request.payload.animalAddressClientId || ''
        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: {
            ...formData,
            clientDetails: {
              ...formData.clientDetails,
              animalsAtClientAddress: 'no',
              animalAddressClientId,
              animalAddress: getClientLabel(animalAddressDetails),
              animalAddressDetails
            }
          }
        })
        request.yar.touch()
        return h.redirect(`/${pageName}`)
      }
    },
    {
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

        const overrides = intent === 'newAnimalAddress'
          ? {
              animalAddressClientId: '',
              animalAddress: '',
              animalAddressDetails: getClientFieldValues(),
              animalAddressEditMode: true,
              animalsAtClientAddress: 'no'
            }
          : {}

        return renderClientDetailsPage(h, submissionFormState, clients, counties, overrides)
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
