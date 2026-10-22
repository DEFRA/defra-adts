import Joi from 'joi'

export const clientDetailsPagePath = '/submission-01-client-details'

export const clientDetailsSchema = Joi.object({
  cph: Joi.string().allow('').required(),
  name: Joi.string().allow('').required(),
  farmName: Joi.string().allow('').required(),
  addressLine1: Joi.string().allow('').required(),
  addressLine2: Joi.string().allow('').required(),
  addressLine3: Joi.string().allow('').required(),
  county: Joi.string().allow('').required(),
  postcode: Joi.string().allow('').required()
})

export const getCounties = async () => {
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

export const getClientDetails = (submissionFormState) => submissionFormState.formData?.clientDetails || {}

export const withClientDetails = (submissionFormState, clientDetails) => ({
  ...submissionFormState,
  formData: {
    ...submissionFormState.formData,
    clientDetails
  }
})

export const getEditedClientDetails = async (selectedClient, clientDetails) => {
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

export const renderClientForm = async (h, client, { isEdit, formAction }) => {
  let countyOptions = []

  try {
    countyOptions = await getCounties()
  } catch (error) {
    console.error('Error contacting backend server:', error.message)
  }

  return h.view('create-edit-client.njk', {
    client,
    isEdit,
    formAction,
    submitText: isEdit ? 'Save changes' : 'Save',
    countyOptions: countyOptions.map((county) => ({
      ...county,
      selected: county.value === String(client.county ?? client.countyId ?? '') ||
        county.text === client.county
    }))
  })
}
