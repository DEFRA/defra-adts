import { HOME_FILTER_STATE_KEY, homeFilterSchema } from './homeFilters.js'

const results = (server) => {
  server.route({
    method: 'GET',
    path: '/results',
    options: {
      validate: {
        query: homeFilterSchema,
        failAction: (request, h, err) => {
          request.log(['results-filter', 'validation-warning'], err.message)
          return err.localised || h.continue
        }
      }
    },
    handler: async (request, h) => {
      request.yar.set(HOME_FILTER_STATE_KEY, request.query)
      request.yar.touch()

      const searchFilters = { ...request.query }
      if (searchFilters.status === 'show_all') {
        delete searchFilters.status
      }
      const queryParams = new URLSearchParams(searchFilters).toString()
      const backendUrl = `${process.env.BACKEND_SERVICE_URL}/submissions?${queryParams}`
      const headers = ['draft', 'show_all'].includes(request.query.status) &&
        process.env.NODE_ENV === 'development' &&
        process.env.LOCAL_DRAFT_OWNER_ID
        ? { 'x-local-draft-owner-id': process.env.LOCAL_DRAFT_OWNER_ID }
        : undefined
      const viewContext = {
        filteredValues: {
          client: request.query.client,
          clinician: request.query.clinician,
          status: request.query.status,
          submitted_date: request.query['submitted-date'] || ''
        }
      }

      try {
        const response = headers
          ? await fetch(backendUrl, { headers })
          : await fetch(backendUrl)

        if (!response.ok) {
          throw new Error(`Backend responded with status: ${response.status}`)
        }

        const payload = await response.json()

        return h.view('results.njk', {
          ...viewContext,
          results: payload.results,
          totalCount: payload.totalCount
        })
      } catch (error) {
        console.error('Error contacting backend server:', error.message)

        return h.view('results.njk', {
          ...viewContext,
          results: [],
          totalCount: 0,
          error: 'Unable to load submissions at this time.'
        })
      }
    }
  })
}

export default results
