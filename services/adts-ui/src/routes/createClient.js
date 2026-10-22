import Joi from 'joi'

const pageName = 'create-client'
const submissionFirstPage = '/submission-01-client-details'

const createClientSchema = Joi.object({
  cph: Joi.string().allow('').required(),
  name: Joi.string().allow('').required(),
  farmName: Joi.string().allow('').required(),
  addressLine1: Joi.string().allow('').required(),
  addressLine2: Joi.string().allow('').required(),
  addressLine3: Joi.string().allow('').required(),
  county: Joi.string().allow('').required(),
  postcode: Joi.string().allow('').required()
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

const createClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        return renderClientForm(h, getClientDetails(submissionFormState), false)
      }
    },
    {
      method: 'GET',
      path: '/edit-client',
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const client = getClientDetails(submissionFormState)

        if (!client?.clientId) {
          return h.redirect(submissionFirstPage)
        }

        return renderClientForm(h, client, true)
      }
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      options: {
        validate: {
          payload: createClientSchema
        }
      },
      handler: (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}

        request.yar.set(
          submissionFormStateKey,
          withClientDetails(submissionFormState, request.payload)
        )
        request.yar.touch()

        return h.redirect(submissionFirstPage)
      }
    },
    {
      method: 'POST',
      path: '/edit-client',
      options: {
        validate: {
          payload: createClientSchema
        }
      },
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const selectedClient = getClientDetails(submissionFormState)

        if (!selectedClient?.clientId) {
          return h.redirect(submissionFirstPage)
        }

        let counties = []
        try {
          counties = await getCounties()
        } catch (error) {
          console.error('Error contacting backend server:', error.message)
        }

        const countyName = counties.find((county) => county.value === request.payload.county)?.text

        request.yar.set(
          submissionFormStateKey,
          withClientDetails(submissionFormState, {
            ...selectedClient,
            ...request.payload,
            countyId: request.payload.county,
            countyName: countyName || ''
          })
        )
        request.yar.touch()

        return h.redirect(submissionFirstPage)
      }
    }
  ])
}

const renderClientForm = async (h, client, isEdit) => {
  let countyOptions = []

  try {
    countyOptions = await getCounties()
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
  }

  return h.view('create-edit-client.njk', {
    client,
    isEdit,
    formAction: isEdit ? '/edit-client' : `/${pageName}`,
    submitText: isEdit ? 'Save changes' : 'Save',
    countyOptions: countyOptions.map((county) => ({
      ...county,
      selected: county.value === String(client.county ?? client.countyId ?? '') ||
        county.text === client.county
    }))
  })
}

export default createClient
