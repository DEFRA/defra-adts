import nunjucks from 'nunjucks'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const env = nunjucks.configure(
  [
    path.resolve(__dirname, '../../../src/views'),
    path.resolve(__dirname, '../../../node_modules/govuk-frontend/dist')
  ],
  { autoescape: true, throwOnUndefined: false }
)

const searchFormTemplate = `
  {% from "macros/submissionSearchForm.njk" import submissionSearchForm %}
  {{ submissionSearchForm(filteredValues, buttonText) }}
`

export const renderSubmissionSearchForm = (filteredValues, buttonText = 'Search') =>
  env.renderString(searchFormTemplate, { filteredValues, buttonText })
