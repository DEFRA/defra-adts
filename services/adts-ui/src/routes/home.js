import Joi from 'joi'
import { HOME_FILTER_STATE_KEY, homeFilterSchema } from './homeFilters.js'

const home = (server) => {
  server.route({
    method: 'GET',
    path: '/',
    // FIX: Removed the validate object here to prevent Joi defaults from clearing the cache
    handler: (request, h) => {
      // 1. Pull the cached search history parameters straight from the session store
      const cached = request.yar.get(HOME_FILTER_STATE_KEY)
      let filterValues

      if (cached) {
        filterValues = cached
      } else {
        filterValues = Joi.attempt({}, homeFilterSchema)
      }

      return h.view('home.njk', {
        user: request.auth.credentials,
        filteredValues: {
          client: filterValues.client,
          clinician: filterValues.clinician,
          status: filterValues.status,
          submitted_date: filterValues['submitted-date'] || ''
        }
      })
    }
  })
}

export default home
