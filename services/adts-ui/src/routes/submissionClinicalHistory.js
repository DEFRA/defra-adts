import { isValid as isValidDate } from 'date-and-time'
import {
  BAD_REQUEST_STATUS,
  BAD_GATEWAY_STATUS,
  loadClientSummary
} from './submissionViewHelpers.js'

const pageName = 'submission-03-clinical-history'
const nextPageName = 'submission-04-tests'
const text = (value) => (typeof value === 'string' ? value.trim() : '')
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const isValidSampleTakenDate = (value) =>
  DATE_PATTERN.test(value) && isValidDate(value, 'YYYY-MM-DD')

const today = () => new Date().toISOString().slice(0, 10)

const savedValues = (submissionFormState) =>
  submissionFormState.formData?.clinicalHistory?.sampleTakenDate || ''

const validate = (payload, maxDate) => {
  const sampleTakenDate = text(payload.sampleTakenDate)
  const errors = {}
  const isSampleTakenDateValid = !sampleTakenDate || isValidSampleTakenDate(sampleTakenDate)

  if (!isSampleTakenDateValid) {
    errors.sampleTakenDate = 'Enter a real date for when the sample was taken'
  }

  if (isSampleTakenDateValid && sampleTakenDate > maxDate) {
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
