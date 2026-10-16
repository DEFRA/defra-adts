import Joi from 'joi'

export const HOME_FILTER_STATE_KEY = 'homeFilterState'

export const homeFilterSchema = Joi.object({
  client: Joi.string().allow('').default(''),
  clinician: Joi.string().allow('').default(''),
  status: Joi.string()
    .valid('show_all', 'draft', 'submitted', 'in_progress', 'cancelled', 'samples_overdue', 'tests_complete')
    .default('show_all'),
  'submitted-date': Joi.string()
    .valid('1_day', '1_week', '14_days', '1_month', '6_months', '1_year', '18_months')
    .allow('')
    .default('18_months')
})
