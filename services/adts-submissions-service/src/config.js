import Joi from 'joi'
import { trimSlashes } from './path-utils.js'

const DEFAULT_LIMS_TIMEOUT_MS = 10000

const schema = Joi.object({
  LIMS_BASE_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  LIMS_PREFIX: Joi.string().allow('').default(''),
  LIMS_TIMEOUT_MS: Joi.number().integer().positive().default(DEFAULT_LIMS_TIMEOUT_MS),
  LIMS_ALLOW_HTTP: Joi.boolean().truthy('true').falsy('false').default(false)
}).unknown(true)

const invalidConfiguration = (setting) => new Error(`Invalid service configuration: ${setting}`)

export const loadConfig = (environment = process.env) => {
  const { value, error } = schema.validate(environment, {
    abortEarly: false,
    convert: true
  })

  if (error) {
    const settings = [...new Set(error.details.map((detail) => detail.path[0]).filter(Boolean))]
    throw invalidConfiguration(settings.join(', ') || 'LIMS settings')
  }

  const baseUrl = new URL(value.LIMS_BASE_URL)
  if (baseUrl.username || baseUrl.password || baseUrl.search || baseUrl.hash) {
    throw invalidConfiguration('LIMS_BASE_URL')
  }

  if (baseUrl.protocol === 'http:' && !value.LIMS_ALLOW_HTTP) {
    throw invalidConfiguration('LIMS_ALLOW_HTTP must explicitly enable the temporary HTTP exception')
  }

  const prefix = trimSlashes(value.LIMS_PREFIX)
  if (prefix.split('/').some((segment) => {
    try {
      const decoded = decodeURIComponent(segment)
      return decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')
    } catch {
      return true
    }
  })) {
    throw invalidConfiguration('LIMS_PREFIX')
  }

  return {
    lims: {
      baseUrl: baseUrl.origin,
      prefix,
      timeoutMs: value.LIMS_TIMEOUT_MS,
      allowHttp: value.LIMS_ALLOW_HTTP
    }
  }
}
