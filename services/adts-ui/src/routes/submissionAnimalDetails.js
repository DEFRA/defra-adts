import { getAnimalDetails } from '../backend/animalDetails.js'
import { loadClientSummary, safeLoad } from './submissionSpecies.js'

const pageName = 'submission-02-animal-details'
const speciesPageName = 'submission-02-species'

const optionsOf = (list) => (Array.isArray(list) ? list : [])
const hasValue = (options, value) => options.some((option) => option.value === value)
const text = (value) => (typeof value === 'string' ? value.trim() : '')

const maxAnimals = 10
const maxAnimalIdLength = 50
const organicOptions = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'in-transition', label: 'In transition' },
  { value: 'unknown', label: "I don't know" }
]
const animalIdField = (index) => `animalId${index}`

// Age category and purpose are required whenever the species offers options; the rest are optional.
// A supplied value must be one of the options offered for the species.
const validate = (payload, details) => {
  const errors = {}
  const numberOfAnimals = Number(text(payload.numberOfAnimals) || 1)
  const values = {
    ageCategory: text(payload.ageCategory),
    purpose: text(payload.purpose),
    keepingType: text(payload.keepingType),
    breed: text(payload.breed),
    sex: text(payload.sex),
    organicAccreditation: text(payload.organicAccreditation),
    numberOfAnimals: Number.isInteger(numberOfAnimals) ? numberOfAnimals : 0,
    animalIds: Array.from({ length: maxAnimals }, (_, i) => text(payload[animalIdField(i + 1)]))
  }

  const optionChecks = [
    ['ageCategory', 'ageCategories', 'age category', true],
    ['purpose', 'purposes', 'purpose', true],
    ['keepingType', 'keepingTypes', 'option for where the animals are kept', false],
    ['breed', 'breeds', 'breed', false],
    ['sex', 'sexes', 'sex', false]
  ]

  for (const [field, listName, label, required] of optionChecks) {
    const options = optionsOf(details[listName])

    if (!values[field]) {
      if (required && options.length > 0) errors[field] = `Select the ${label}`
    } else if (!hasValue(options, values[field])) {
      errors[field] = `Select a valid ${label}`
    }
  }

  if (values.organicAccreditation &&
    !(details.organicAccreditationApplicable && hasValue(organicOptions, values.organicAccreditation))) {
    errors.organicAccreditation = 'Select a valid option for organic accreditation'
  }

  if (values.numberOfAnimals < 1 || values.numberOfAnimals > maxAnimals) {
    errors.numberOfAnimals = `Select a number of animals from 1 to ${maxAnimals}`
  }

  const tooLong = values.animalIds.findIndex((id, i) => i < values.numberOfAnimals && id.length > maxAnimalIdLength)
  if (tooLong >= 0) {
    errors[animalIdField(tooLong + 1)] = `Animal ${tooLong + 1} ID must be ${maxAnimalIdLength} characters or fewer`
  }

  return { values, errors }
}

const savedValues = (animalDetails = {}) => ({
  ageCategory: animalDetails.ageCategory || '',
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
  ageCategoryItems: toRadioItems(details.ageCategories, values.ageCategory),
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

const submissionAnimalDetails = (server, submissionFormStateKey) => {
  const render = async (h, submissionFormState, { details, values, errors = {}, detailsError }) => {
    const clientSummary = await loadClientSummary(submissionFormState)
    const { species } = submissionFormState.formData.animalDetails

    const view = h.view('submission-animal-details.njk', {
      submissionFormState,
      clientSummary,
      species,
      speciesPageUrl: `/${speciesPageName}`,
      animalDetails: details,
      animalDetailsUnavailable: Boolean(detailsError),
      values,
      errors,
      ...(details ? buildFields(details, values, errors) : {})
    })

    if (detailsError) return view.code(502)
    return Object.keys(errors).length > 0 ? view.code(400) : view
  }

  const getSpeciesContext = (request) => {
    const submissionFormState = request.yar.get(submissionFormStateKey) || {}
    const { speciesId } = submissionFormState.formData?.animalDetails || {}

    return { submissionFormState, speciesId }
  }

  server.route([
    {
      method: 'GET',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const { submissionFormState, speciesId } = getSpeciesContext(request)

        // A species must be chosen first; the options on this page depend on it.
        if (!speciesId) {
          return h.redirect(`/${speciesPageName}`)
        }

        const result = await safeLoad(() => getAnimalDetails(speciesId))

        return render(h, submissionFormState, {
          details: result.data,
          detailsError: result.error,
          values: savedValues(submissionFormState.formData.animalDetails)
        })
      }
    },
    {
      method: 'POST',
      path: `/${pageName}`,
      handler: async (request, h) => {
        const { submissionFormState, speciesId } = getSpeciesContext(request)

        if (!speciesId) {
          return h.redirect(`/${speciesPageName}`)
        }

        const result = await safeLoad(() => getAnimalDetails(speciesId))

        if (result.error) {
          return render(h, submissionFormState, {
            detailsError: result.error,
            values: savedValues(submissionFormState.formData.animalDetails)
          })
        }

        const { values, errors } = validate(request.payload || {}, result.data)

        if (Object.keys(errors).length > 0) {
          return render(h, submissionFormState, { details: result.data, values, errors })
        }

        const { numberOfAnimals, animalIds, ...rest } = values
        const animalDetails = {
          speciesId: submissionFormState.formData.animalDetails.speciesId,
          species: submissionFormState.formData.animalDetails.species,
          numberOfAnimals
        }

        for (const [key, value] of Object.entries(rest)) {
          if (value) animalDetails[key] = value
        }
        // IDs beyond the chosen number of animals are discarded.
        const ids = animalIds.slice(0, numberOfAnimals)
        if (ids.some(Boolean)) animalDetails.animalIds = ids

        request.yar.set(submissionFormStateKey, {
          ...submissionFormState,
          formData: { ...submissionFormState.formData, animalDetails }
        })
        request.yar.touch()

        return h.redirect(`/${pageName}`)
      }
    }
  ])
}

export default submissionAnimalDetails
