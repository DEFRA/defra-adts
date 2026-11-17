import { getAnimalDetails } from '../backend/animalDetails.js'
import {
  BAD_GATEWAY_STATUS,
  BAD_REQUEST_STATUS,
  loadClientSummary,
  safeLoad
} from './submissionViewHelpers.js'

const pageName = 'submission-02-animal-details'
const speciesPageName = 'submission-02-species'
const nextPageName = 'submission-03-clinical-history'

const optionsOf = (list) => (Array.isArray(list) ? list : [])
const hasValue = (options, value) => options.some((option) => option.value === value)
const text = (value) => (typeof value === 'string' ? value.trim() : '')
const normalized = (value) => text(value).toLowerCase().replace(/[^a-z]/g, '')
const isAgeDetailExcluded = (value, options) => {
  const category = optionsOf(options).find((option) => option.value === value)
  const terms = [normalized(value), normalized(category?.label)]

  return terms.some((term) =>
    term === 'unknown' || term === 'doesntapply' || term === 'doesnotapply')
}

const maxAnimals = 10
const maxAnimalIdLength = 50
const organicOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'in-transition', label: 'In transition' },
  { value: 'unknown', label: "I don't know" }
]
const animalIdField = (index) => `animalId${index}`

const validateOption = (values, details, errors, field, listName, label, required) => {
  const options = optionsOf(details[listName])

  if (!values[field]) {
    if (required && options.length > 0) {
      errors[field] = `Select the ${label}`
    }
    return
  }

  if (!hasValue(options, values[field])) {
    errors[field] = `Select a valid ${label}`
  }
}

const ageDetailsAllowed = (ageCategory, details) =>
  optionsOf(details.ageCategories).length > 0 &&
  !isAgeDetailExcluded(ageCategory, details.ageCategories)

const buildValues = (payload, details) => {
  const ageCategory = text(payload.ageCategory)
  const includeAgeDetail = ageDetailsAllowed(ageCategory, details)

  return {
    ageCategory,
    age: includeAgeDetail ? text(payload.age) : '',
    ageIndicator: includeAgeDetail ? text(payload.ageIndicator) : '',
    isEstimate: includeAgeDetail && ['true', 'on', true].includes(payload.isEstimate),
    purpose: text(payload.purpose),
    keepingType: text(payload.keepingType),
    breed: text(payload.breed),
    sex: text(payload.sex),
    organicAccreditation: text(payload.organicAccreditation),
    numberOfAnimals: Number(text(payload.numberOfAnimals) || 1),
    animalIds: Array.from({ length: maxAnimals }, (_, i) => text(payload[animalIdField(i + 1)]))
  }
}

const validateOptions = (values, details, errors) => {
  const optionChecks = [
    ['ageCategory', 'ageCategories', 'age category', true],
    ['purpose', 'purposes', 'purpose', true],
    ['keepingType', 'keepingTypes', 'option for where the animals are kept', false],
    ['breed', 'breeds', 'breed', false],
    ['sex', 'sexes', 'sex', false]
  ]

  for (const [field, listName, label, required] of optionChecks) {
    validateOption(values, details, errors, field, listName, label, required)
  }
}

const validateAgeDetail = (values, details, errors) => {
  if (values.age || values.ageIndicator) {
    const age = Number(values.age)
    if (!values.age || !Number.isFinite(age) || age < 0) {
      errors.age = 'Enter an age of 0 or more'
    }

    if (!values.ageIndicator || !hasValue(optionsOf(details.ageUnits), values.ageIndicator)) {
      errors.ageIndicator = 'Select a valid age indicator'
    }
  }
}

const validateOrganicAccreditation = (values, details, errors) => {
  const isValid = details.organicAccreditationApplicable &&
    hasValue(organicOptions, values.organicAccreditation)

  if (values.organicAccreditation && !isValid) {
    errors.organicAccreditation = 'Select a valid option for organic accreditation'
  }
}

const validateNumberOfAnimals = (values, errors) => {
  if (values.numberOfAnimals < 1 || values.numberOfAnimals > maxAnimals) {
    errors.numberOfAnimals = `Select a number of animals from 1 to ${maxAnimals}`
  }
}

const validateAnimalIds = (values, errors) => {
  const tooLong = values.animalIds.findIndex((id, i) => i < values.numberOfAnimals && id.length > maxAnimalIdLength)
  if (tooLong >= 0) {
    errors[animalIdField(tooLong + 1)] = `Animal ${tooLong + 1} ID must be ${maxAnimalIdLength} characters or fewer`
  }
}

// Age category and purpose are required whenever the species offers options; the rest are optional.
// A supplied value must be one of the options offered for the species.
const validate = (payload, details) => {
  const values = buildValues(payload, details)
  if (!Number.isInteger(values.numberOfAnimals)) {
    values.numberOfAnimals = 0
  }

  const errors = {}
  validateOptions(values, details, errors)
  validateAgeDetail(values, details, errors)
  validateOrganicAccreditation(values, details, errors)
  validateNumberOfAnimals(values, errors)
  validateAnimalIds(values, errors)

  return { values, errors }
}

const savedValues = (animalDetails = {}) => ({
  ageCategory: animalDetails.ageCategory || '',
  age: animalDetails.ageDetail?.value === undefined ? '' : String(animalDetails.ageDetail.value),
  ageIndicator: animalDetails.ageDetail?.unit || '',
  isEstimate: animalDetails.ageDetail?.isEstimate === true,
  purpose: animalDetails.purpose || '',
  keepingType: animalDetails.keepingType || '',
  breed: animalDetails.breed || '',
  sex: animalDetails.sex || '',
  organicAccreditation: animalDetails.organicAccreditation || '',
  numberOfAnimals: animalDetails.numberOfAnimals || 1,
  animalIds: Array.from({ length: maxAnimals }, (_, i) => animalDetails.animalIds?.[i] || '')
})

const toSelectItems = (options, selected, placeholder) => [
  { value: '', text: placeholder, selected: !selected },
  ...optionsOf(options).map((option) => ({ value: option.value, text: option.label, selected: option.value === selected }))
]

const toRadioItems = (options, selected) =>
  optionsOf(options).map((option) => ({ value: option.value, text: option.label, checked: option.value === selected }))

const buildFields = (details, values, errors) => ({
  ageCategoryItems: optionsOf(details.ageCategories).map((option) => ({
    value: option.value,
    text: option.label,
    checked: option.value === values.ageCategory,
    ...(isAgeDetailExcluded(option.value, details.ageCategories)
      ? { attributes: { 'data-age-detail-excluded': 'true' } }
      : {})
  })),
  showAgeDetails: optionsOf(details.ageCategories).length > 0 &&
    !isAgeDetailExcluded(values.ageCategory, details.ageCategories),
  ageIndicatorItems: toSelectItems(details.ageUnits, values.ageIndicator, 'Select an age indicator'),
  ageError: errors.age,
  ageIndicatorError: errors.ageIndicator,
  purposeItems: toRadioItems(details.purposes, values.purpose),
  keepingTypeItems: toRadioItems(details.keepingTypes, values.keepingType),
  breedItems: toSelectItems(details.breeds, values.breed, ''),
  sexItems: toRadioItems(details.sexes, values.sex),
  showOrganicAccreditation: details.organicAccreditationApplicable === true,
  organicItems: toRadioItems(organicOptions, values.organicAccreditation),
  numberOfAnimalsItems: Array.from({ length: maxAnimals }, (_, i) => ({
    value: String(i + 1), text: String(i + 1), selected: i + 1 === values.numberOfAnimals
  })),
  animalIdInputs: values.animalIds.map((value, i) => ({
    id: animalIdField(i + 1), index: i + 1, value, error: errors[animalIdField(i + 1)]
  }))
})

const renderAnimalDetails = async (h, submissionFormState, {
  details,
  values,
  errors = {},
  detailsError
}) => {
  const clientSummaryResult = await loadClientSummary(submissionFormState)
  const { species } = submissionFormState.formData.animalDetails

  const view = h.view('submission-animal-details.njk', {
    submissionFormState,
    ...clientSummaryResult,
    species,
    speciesPageUrl: `/${speciesPageName}`,
    animalDetails: details,
    animalDetailsUnavailable: Boolean(detailsError),
    values,
    errors,
    ...(details ? buildFields(details, values, errors) : {})
  })

  if (detailsError || clientSummaryResult.clientSummaryError) {
    return view.code(BAD_GATEWAY_STATUS)
  }

  if (Object.keys(errors).length > 0) {
    return view.code(BAD_REQUEST_STATUS)
  }

  return view
}

const getSpeciesContext = (request, submissionFormStateKey) => {
  const submissionFormState = request.yar.get(submissionFormStateKey) || {}
  const { speciesId } = submissionFormState.formData?.animalDetails || {}

  return { submissionFormState, speciesId }
}

const getAnimalDetailsPage = async (request, h, submissionFormStateKey) => {
  const { submissionFormState, speciesId } = getSpeciesContext(request, submissionFormStateKey)

  // A species must be chosen first; the options on this page depend on it.
  if (!speciesId) {
    return h.redirect(`/${speciesPageName}`)
  }

  const result = await safeLoad(() => getAnimalDetails(speciesId))

  return renderAnimalDetails(h, submissionFormState, {
    details: result.data,
    detailsError: result.error,
    values: savedValues(submissionFormState.formData.animalDetails)
  })
}

const buildAnimalDetails = (submissionFormState, values) => {
  const { numberOfAnimals, animalIds, age, ageIndicator, isEstimate, ...rest } = values
  const savedDetails = submissionFormState.formData.animalDetails
  const animalDetails = {
    speciesId: savedDetails.speciesId,
    species: savedDetails.species,
    numberOfAnimals
  }

  for (const [key, value] of Object.entries(rest)) {
    if (value) {
      animalDetails[key] = value
    }
  }

  if (age && ageIndicator) {
    animalDetails.ageDetail = {
      value: Number(age),
      unit: ageIndicator,
      isEstimate
    }
  }

  // IDs beyond the chosen number of animals are discarded.
  const ids = animalIds.slice(0, numberOfAnimals)
  if (ids.some(Boolean)) {
    animalDetails.animalIds = ids
  }

  return animalDetails
}

const postAnimalDetails = async (request, h, submissionFormStateKey) => {
  const { submissionFormState, speciesId } = getSpeciesContext(request, submissionFormStateKey)

  if (!speciesId) {
    return h.redirect(`/${speciesPageName}`)
  }

  const result = await safeLoad(() => getAnimalDetails(speciesId))
  const previousDetails = submissionFormState.formData.animalDetails
  const values = savedValues(previousDetails)

  if (result.error) {
    return renderAnimalDetails(h, submissionFormState, {
      detailsError: result.error,
      values
    })
  }

  const { values: submittedValues, errors } = validate(request.payload || {}, result.data)
  if (Object.keys(errors).length > 0) {
    return renderAnimalDetails(h, submissionFormState, {
      details: result.data,
      values: submittedValues,
      errors
    })
  }

  const animalDetails = buildAnimalDetails(submissionFormState, submittedValues)
  request.yar.set(submissionFormStateKey, {
    ...submissionFormState,
    formData: { ...submissionFormState.formData, animalDetails }
  })
  request.yar.touch()

  return h.redirect(`/${nextPageName}`)
}

const submissionAnimalDetails = (server, submissionFormStateKey) => {
  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: (request, h) => getAnimalDetailsPage(request, h, submissionFormStateKey)
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      handler: (request, h) => postAnimalDetails(request, h, submissionFormStateKey)
    }
  ])
}

export default submissionAnimalDetails
