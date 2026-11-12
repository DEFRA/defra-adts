import { BAD_REQUEST_STATUS } from './submissionViewHelpers.js'
import {
  animalAddressPageName,
  clientAddressPageName,
  getAnimalAddressFieldValues,
  getClientFieldValues,
  getClientLabel,
  loadClients,
  loadCounties,
  pageName,
  renderAnimalAddressPage,
  renderClientAddressPage
} from './selectClientView.js'
import {
  animalAddressSchema,
  clientAddressSchema,
  CPH_ERROR,
  CPH_PATTERN,
  saveClientDraftForAddress,
  saveClientDraftForAnimalAddress,
  submissionClientSchema
} from './selectClient.js'

const getRequiredAddressErrors = (details, requiredFields) => Object.fromEntries(
  requiredFields
    .filter(([valueField]) => !details[valueField].trim())
    .map(([, errorField, label]) => [errorField, `Enter ${label}`])
)

const getClientAddressPageRoute = (submissionFormStateKey) => ({
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
})

const postClientAddressStartRoute = (submissionFormStateKey) => ({
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
})

const postClientAddressRoute = (submissionFormStateKey) => ({
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
    const errors = getRequiredAddressErrors(clientDetails, [
      ['name', 'name', 'client name'],
      ['farmName', 'farmName', 'farm name'],
      ['addressLine1', 'addressLine1', 'the first line of the address'],
      ['postcode', 'postcode', 'postcode']
    ])
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
        Object.keys(clientDetails).map((fieldName) => [fieldName, clientDetails[fieldName].trim()])
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
})

const getAnimalAddressPageRoute = (submissionFormStateKey) => ({
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
})

const postAnimalAddressStartRoute = (submissionFormStateKey) => ({
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

    saveClientDraftForAnimalAddress({
      request,
      submissionFormStateKey,
      submissionFormState,
      formData,
      payload,
      selectedClient,
      selectedAnimalAddress,
      startNewAnimalAddress: true
    })
    return h.redirect(`/${animalAddressPageName}?intent=new`)
  }
})

const postAnimalAddressRoute = (submissionFormStateKey) => ({
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
    const errors = getRequiredAddressErrors(details, [
      ['addressLine1', 'animalAddressAddressLine1', 'the first line of the address'],
      ['postcode', 'animalAddressPostcode', 'postcode']
    ])
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
      Object.keys(details).map((fieldName) => [fieldName, details[fieldName].trim()])
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
})

const selectClientAddressRoutes = (server, submissionFormStateKey) => {
  server.route([
    getClientAddressPageRoute(submissionFormStateKey),
    postClientAddressStartRoute(submissionFormStateKey),
    postClientAddressRoute(submissionFormStateKey),
    getAnimalAddressPageRoute(submissionFormStateKey),
    postAnimalAddressStartRoute(submissionFormStateKey),
    postAnimalAddressRoute(submissionFormStateKey)
  ])
}

export default selectClientAddressRoutes
