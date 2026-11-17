import Joi from 'joi'

const schema = Joi.object({
  LIMS_BASE_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
  LIMS_PREFIX: Joi.string().allow('').default(''),
  LIMS_USERNAME: Joi.string().min(1).required(),
  LIMS_PASSWORD: Joi.string().min(1).required(),
  LIMS_TIMEOUT_MS: Joi.number().integer().positive().default(10000),
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

  const prefix = value.LIMS_PREFIX.replace(/^\/+|\/+$/g, '')
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
      username: value.LIMS_USERNAME,
      password: value.LIMS_PASSWORD,
      timeoutMs: value.LIMS_TIMEOUT_MS,
      allowHttp: value.LIMS_ALLOW_HTTP
    }
  }
}
