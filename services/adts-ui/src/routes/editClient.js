import {
  clientDetailsPagePath,
  clientDetailsSchema,
  getClientDetails,
  getEditedClientDetails,
  renderClientForm,
  withClientDetails
} from './clientForm.js'

const pagePath = '/edit-client'

const editClient = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: pagePath,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const client = getClientDetails(submissionFormState)

        if (!client?.clientId) {
          return h.redirect(clientDetailsPagePath)
        }

        return renderClientForm(h, client, {
          isEdit: true,
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
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || {}
        const selectedClient = getClientDetails(submissionFormState)

        if (!selectedClient?.clientId) {
          return h.redirect(clientDetailsPagePath)
        }

        const clientDetails = await getEditedClientDetails(selectedClient, request.payload)
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

export default editClient
