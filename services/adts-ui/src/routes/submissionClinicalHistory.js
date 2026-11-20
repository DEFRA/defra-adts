import { format, isValid as isValidDate, parse } from 'date-and-time'
import {
  BAD_REQUEST_STATUS,
  BAD_GATEWAY_STATUS,
  loadClientSummary
} from './submissionViewHelpers.js'

const pageName = 'submission-03-clinical-history'
const nextPageName = 'submission-04-tests'
const text = (value) => (typeof value === 'string' ? value.trim() : '')
const DATE_ERROR = 'Enter a real date for when the sample was taken'
const FUTURE_DATE_ERROR = 'The sample date must be today or in the past'

const today = () => new Date().toISOString().slice(0, 10)

const savedValues = (submissionFormState) => {
  const clinicalHistory = submissionFormState.formData?.clinicalHistory || {}
  const [year = '', month = '', day = ''] = (clinicalHistory.sampleTakenDate || '').split('-')
  return {
    day,
    month,
    year,
    contactedAboutSameCase: clinicalHistory.contactedAboutSameCase || '',
    previousSubmissionReference: clinicalHistory.previousSubmissionReference || '',
    contactMethods: clinicalHistory.contactMethods || []
  }
}

const contactMethodOptions = ['phone', 'farmVisit']

const submittedValues = (payload) => ({
  day: text(payload['sampleTakenDate-day']),
  month: text(payload['sampleTakenDate-month']),
  year: text(payload['sampleTakenDate-year']),
  contactedAboutSameCase: ['yes', 'no'].includes(payload.contactedAboutSameCase)
    ? payload.contactedAboutSameCase
    : '',
  previousSubmissionReference: text(payload.previousSubmissionReference),
  contactMethods: (Array.isArray(payload.contactMethods)
    ? payload.contactMethods
    : [payload.contactMethods])
    .filter((method) => contactMethodOptions.includes(method))
})

const validate = (values, maxDate) => {
  const { day, month, year } = values
  const errors = {}

  if (!day && !month && !year) {
    return { values, sampleTakenDate: '', errors }
  }

  const dateString = `${year}-${month}-${day}`
  if (!day || !month || !year || !isValidDate(dateString, 'YYYY-M-D')) {
    errors.sampleTakenDate = DATE_ERROR
    return { values, sampleTakenDate: '', errors }
  }

  const sampleTakenDate = format(parse(dateString, 'YYYY-M-D'), 'YYYY-MM-DD')
  if (sampleTakenDate > maxDate) {
    errors.sampleTakenDate = FUTURE_DATE_ERROR
    return { values, sampleTakenDate: '', errors }
  }

  return { values, sampleTakenDate, errors }
}

const renderPage = async (request, h, submissionFormState, values, errors = {}) => {
  const clientSummaryResult = await loadClientSummary(submissionFormState, request)
  const errorList = errors.sampleTakenDate
    ? [{ text: errors.sampleTakenDate, href: '#sampleTakenDate-day' }]
    : []

  const view = h.view('submission-clinical-history.njk', {
    submissionFormState,
    ...clientSummaryResult,
    values,
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
        return renderPage(request, h, submissionFormState, savedValues(submissionFormState))
      }
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const submissionFormState = request.yar.get(submissionFormStateKey) || { formData: {} }
        const { values, sampleTakenDate, errors } = validate(submittedValues(request.payload || {}), today())

        if (Object.keys(errors).length) {
          return renderPage(request, h, submissionFormState, values, errors)
        }

        const formData = submissionFormState.formData || {}
        const clinicalHistory = { ...formData.clinicalHistory }
        if (sampleTakenDate) {
          clinicalHistory.sampleTakenDate = sampleTakenDate
        } else {
          delete clinicalHistory.sampleTakenDate
        }

        if (values.contactedAboutSameCase === 'yes') {
          clinicalHistory.contactedAboutSameCase = 'yes'
          clinicalHistory.previousSubmissionReference = values.previousSubmissionReference
          clinicalHistory.contactMethods = values.contactMethods
        } else if (values.contactedAboutSameCase === 'no') {
          clinicalHistory.contactedAboutSameCase = 'no'
          delete clinicalHistory.previousSubmissionReference
          delete clinicalHistory.contactMethods
        } else {
          delete clinicalHistory.contactedAboutSameCase
          delete clinicalHistory.previousSubmissionReference
          delete clinicalHistory.contactMethods
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
