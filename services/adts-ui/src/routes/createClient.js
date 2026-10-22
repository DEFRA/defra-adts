import {
  clientDetailsPagePath,
  clientDetailsSchema,
  getClientDetails,
  renderClientForm,
  withClientDetails
} from './clientForm.js'

const pagePath = '/create-client'

const createClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: pagePath,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const client = getClientDetails(submissionFormState)

        return renderClientForm(h, client, {
          isEdit: false,
          formAction: pagePath
        })
      }
    },
    {
      method: 'POST',
      path: pagePath,
      options: {
        validate: {
          payload: clientDetailsSchema
        }
      },
      handler: (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        request.yar.set(
          submissionFormStateKey,
          withClientDetails(submissionFormState, request.payload)
        )
        request.yar.touch()

        return h.redirect(clientDetailsPagePath)
      }
    }
  ])
}

export default createClient
