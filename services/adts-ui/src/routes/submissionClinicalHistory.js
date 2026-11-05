import {
  BAD_REQUEST_STATUS,
  BAD_GATEWAY_STATUS,
  loadClientSummary
} from './submissionViewHelpers.js'

const pageName = 'submission-03-clinical-history'
const nextPageName = 'submission-04-tests'
const text = (value) => (typeof value === 'string' ? value.trim() : '')
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const isValidDate = (value) => {
  if (!DATE_PATTERN.test(value)) {
    return false
  }
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(0)
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCFullYear(year, month - 1, day)

  return year > 0 &&
    month >= 1 && month <= 12 &&
    day >= 1 && day <= 31 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

const today = () => new Date().toISOString().slice(0, 10)

const savedValues = (submissionFormState) =>
  submissionFormState.formData?.clinicalHistory?.sampleTakenDate || ''

const validate = (payload, maxDate) => {
  const sampleTakenDate = text(payload.sampleTakenDate)
  const errors = {}

  if (sampleTakenDate && !isValidDate(sampleTakenDate)) {
    errors.sampleTakenDate = 'Enter a real date for when the sample was taken'
  } else if (sampleTakenDate && sampleTakenDate > maxDate) {
    errors.sampleTakenDate = 'The sample date must be today or in the past'
  }

  return { values: sampleTakenDate, sampleTakenDate, errors }
}

const renderPage = async (h, submissionFormState, values, errors = {}) => {
  const clientSummaryResult = await loadClientSummary(submissionFormState)
  const errorList = errors.sampleTakenDate
    ? [{ text: errors.sampleTakenDate, href: '#sampleTakenDate' }]
    : []

  const view = h.view('submission-clinical-history.njk', {
    submissionFormState,
    ...clientSummaryResult,
    values,
    maxDate: today(),
    errors,
    errorList
  })

  if (clientSummaryResult.clientSummaryError) {
    return view.code(BAD_GATEWAY_STATUS)
  }

  if (Object.keys(errors).length) {
    return view.code(BAD_REQUEST_STATUS)
  }

  return view
}

const submissionClinicalHistory = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || { formData: {} }
        return renderPage(h, submissionFormState, savedValues(submissionFormState))
      }
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || { formData: {} }
        const { values, sampleTakenDate, errors } = validate(request.payload || {}, today())

        if (Object.keys(errors).length) {
          return renderPage(h, submissionFormState, values, errors)
        }

        const formData = submissionFormState.formData || {}
        const clinicalHistory = { ...formData.clinicalHistory }
        if (sampleTakenDate) {
          clinicalHistory.sampleTakenDate = sampleTakenDate
        } else {
          delete clinicalHistory.sampleTakenDate
        }

        const updatedFormData = { ...formData }
        if (Object.keys(clinicalHistory).length) {
          updatedFormData.clinicalHistory = clinicalHistory
        } else {
          delete updatedFormData.clinicalHistory
        }

        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: updatedFormData
        })
        request.yar.touch()

        return h.redirect(`/${nextPageName}`)
      }
    }
  ])
}

export default submissionClinicalHistory
