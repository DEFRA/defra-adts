import Joi from 'joi'

const pagePath = '/create-edit-client'
const createMode = 'create'
const editMode = 'edit'
const clientDetailsPagePath = '/submission-01-client-details'

const createEditClientSchema = Joi.object({
  cph: Joi.string().allow('').required(),
  name: Joi.string().allow('').required(),
  farmName: Joi.string().allow('').required(),
  addressLine1: Joi.string().allow('').required(),
  addressLine2: Joi.string().allow('').required(),
  addressLine3: Joi.string().allow('').required(),
  county: Joi.string().allow('').required(),
  postcode: Joi.string().allow('').required()
})

const clientFormQuerySchema = Joi.object({
  mode: Joi.string().valid(createMode, editMode).required()
})

const getCounties = async () => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetch(`${backendBaseUrl}/GetCounties`)

  if (!response.ok) {
    throw new Error(`County lookup returned status: ${response.status}`)
  }

  const counties = await response.json()

  return counties.map((county) => ({
    value: String(county.countyId),
    text: county.name
  }))
}

const getClientDetails = (submissionFormState) => submissionFormState.formData?.clientDetails || {}

const withClientDetails = (submissionFormState, clientDetails) => ({
  ...submissionFormState,
  formData: {
    ...submissionFormState.formData,
    clientDetails
  }
})

const getEditedClientDetails = async (selectedClient, clientDetails) => {
  let counties = []
  try {
    counties = await getCounties()
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
  }

  const countyName = counties.find((county) => county.value === clientDetails.county)?.text

  return {
    ...selectedClient,
    ...clientDetails,
    countyId: clientDetails.county,
    countyName: countyName || ''
  }
}

const createEditClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: pagePath,
      options: {
        validate: {
          query: clientFormQuerySchema
        }
      },
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const client = getClientDetails(submissionFormState)

        if (request.query.mode === editMode && !client?.clientId) {
          return h.redirect(clientDetailsPagePath)
        }

        return renderClientForm(h, client, request.query.mode)
      }
    },
    {
      method: 'POST',
      path: pagePath,
      options: {
        validate: {
          query: clientFormQuerySchema,
          payload: createEditClientSchema
        }
      },
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const mode = request.query.mode
        const selectedClient = getClientDetails(submissionFormState)

        if (mode === editMode && !selectedClient?.clientId) {
          return h.redirect(clientDetailsPagePath)
        }

        const clientDetails = mode === editMode
          ? await getEditedClientDetails(selectedClient, request.payload)
          : request.payload

        request.yar.set(
          submissionFormStateKey,
          withClientDetails(submissionFormState, clientDetails)
        )
        request.yar.touch()

        return h.redirect(clientDetailsPagePath)
      }
    }
  ])
}

const renderClientForm = async (h, client, mode) => {
  let countyOptions = []

  try {
    countyOptions = await getCounties()
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
  }

  return h.view('create-edit-client.njk', {
    client,
    isEdit: mode === editMode,
    formAction: `${pagePath}?mode=${mode}`,
    submitText: mode === editMode ? 'Save changes' : 'Save',
    countyOptions: countyOptions.map((county) => ({
      ...county,
      selected: county.value === String(client.county ?? client.countyId ?? '') ||
        county.text === client.county
    }))
  })
}

export default createEditClient
