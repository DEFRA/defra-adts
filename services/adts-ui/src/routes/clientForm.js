import Joi from 'joi'

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

export const renderClientForm = (h, client, { isEdit, formAction }) =>
  h.view('create-client.njk', {
    client,
    isEdit,
    formAction,
    submitText: isEdit ? 'Save changes' : 'Save'
  })
