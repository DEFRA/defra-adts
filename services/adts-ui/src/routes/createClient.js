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

const createClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const formDetails = request.yar.get(submissionFormStateKey) || {}
        let countyOptions = []

        try {
          countyOptions = await getCounties()
        } catch (error) {
          console.error('Error contacting backend server:', error.message)
        }

        const client = formDetails.client || {}

        return h.view('create-client.njk', {
          client,
          countyOptions: countyOptions.map((county) => ({
            ...county,
            selected: county.value === client.county
          }))
        })
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
        const formDetails = request.yar.get(submissionFormStateKey) || {}

        request.yar.set(submissionFormStateKey, {
          ...formDetails,
          client: request.payload
        })
        request.yar.touch()

        return h.redirect(submissionFirstPage)
      }
    }
  ])
}

export default createClient
