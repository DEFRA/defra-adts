import Joi from 'joi'
import { createServiceError, normalizeLimsBusinessError, normalizeUpstreamStatus } from '../errors.js'

const legacyString = Joi.string().allow('')
const nullableLegacyString = legacyString.allow(null)

const draftAnimal = Joi.object({
  id: Joi.number().integer().min(0).required(),
  name: legacyString.required()
}).unknown(false)

const draftAnimalSample = Joi.object({
  animalId: Joi.number().integer().min(0).required(),
  animalName: legacyString.required(),
  sampleId: legacyString.required(),
  poolGroup: Joi.number().integer().allow(null).required(),
  packageProductId: legacyString
}).unknown(false)

const draftSampleType = Joi.object({
  packageProductId: legacyString.required(),
  sampleType: legacyString.required()
}).unknown(false)

const draftProductOption = Joi.object({
  packageProductId: legacyString.required(),
  option: legacyString.required()
}).unknown(false)

const draftProduct = Joi.object({
  productId: Joi.string().min(1).required(),
  productType: Joi.string().min(1).required(),
  isFOP: Joi.boolean().required(),
  isSOP: Joi.boolean().required(),
  animalSamples: Joi.array().items(draftAnimalSample).required(),
  sampleTypes: Joi.array().items(draftSampleType).required(),
  options: Joi.array().items(draftProductOption).required()
}).unknown(false)

export const draftBody = Joi.object({
  draftSubmissionId: nullableLegacyString.required(),
  submissionType: Joi.string().valid('MONI', 'DIAG').required(),
  pvsId: Joi.string().min(1).required(),
  clientName: legacyString.required(),
  clientFarm: legacyString.required(),
  clientAddress: legacyString.required(),
  clientPostcode: legacyString.required(),
  clientCounty: legacyString.required(),
  clientSubCounty: nullableLegacyString.required(),
  clientCPHH: legacyString.required(),
  clinician: legacyString.max(1000).required(),
  resultsReadyConfirmationEmail: legacyString.required(),
  resultsReadyConfirmationPhoneNumber: legacyString.required(),
  areAnimalsAtFarmAddress: Joi.boolean().required(),
  animalCPHH: nullableLegacyString.required(),
  animalFarm: nullableLegacyString.required(),
  animalAddress: legacyString.required(),
  animalPostcode: nullableLegacyString.required(),
  animalCounty: nullableLegacyString.required(),
  animalSubCounty: nullableLegacyString.required(),
  animalSpeciesId: legacyString.required(),
  animalBreedId: legacyString.required(),
  animals: Joi.array().items(draftAnimal).required(),
  animalSexId: legacyString.required(),
  animalAgeId: legacyString.required(),
  ageDetail: nullableLegacyString.required(),
  ageIndicator: Joi.string().valid('NONE', 'DAYS', 'WEEKS', 'MONTHS', 'YEARS').allow(null).required(),
  ageIsEstimate: Joi.boolean().allow(null).required(),
  animalOrganicId: legacyString.required(),
  animalPurposeId: legacyString.required(),
  animalHousingId: legacyString.required(),
  dateSamplesTaken: Joi.string().pattern(/^\d{2}\/\d{2}\/\d{4}$/).allow(null).required(),
  previousSubmissionId: legacyString.required(),
  previousSubmissionContactByPhone: Joi.boolean().allow(null).required(),
  previousSubmissionContactByAphaFarmVisit: Joi.boolean().allow(null).required(),
  herdTotal: nullableLegacyString.required(),
  herdBreedingTotal: nullableLegacyString.required(),
  herdAffectedTotal: nullableLegacyString.required(),
  herdAffectedIncDead: nullableLegacyString.required(),
  herdDeadTotal: nullableLegacyString.required(),
  clinicalSign1Id: legacyString.required(),
  clinicalSign2Id: legacyString.required(),
  clinicalSign3Id: legacyString.required(),
  clinicalSignDurationId: legacyString.required(),
  clinicalHistory: nullableLegacyString.required(),
  products: Joi.array().items(draftProduct).required(),
  samplesWillSendToSeparateAddresses: Joi.boolean().allow(null).required(),
  canUseSurveillance: Joi.boolean().required(),
  cancelSubmission: nullableLegacyString.required(),
  masterSubmissionId: nullableLegacyString.required(),
  linkedFirstOfPairSubmissionId: nullableLegacyString.required(),
  sendersReference: nullableLegacyString.required()
}).unknown(false)

const outcomeUnknown = (request) => ({
  statusCode: 504,
  body: createServiceError({
    category: 'outcome_unknown',
    message: 'The LIMS draft save outcome is unknown. Reconcile the draft with LIMS before retrying.',
    correlationId: request.info.id
  }).body
})

const saveDraft = async (request, h, limsClient, statusCode) => {
  const payload = request.payload

  if (request.params?.draftId && payload.draftSubmissionId !== request.params.draftId) {
    const error = createServiceError({
      category: 'validation_error',
      message: 'The draft ID in the path must match draftSubmissionId in the body.',
      correlationId: request.info.id
    })
    return h.response(error.body).code(error.statusCode)
  }

  let response
  try {
    response = await limsClient.request('submissions/createUpdateDraftSubmission', {
      method: 'POST',
      body: payload
    })
  } catch {
    const error = outcomeUnknown(request)
    return h.response(error.body).code(error.statusCode)
  }

  let result
  try {
    result = await response.json()
  } catch {
    const error = outcomeUnknown(request)
    return h.response(error.body).code(error.statusCode)
  }

  const businessError = normalizeLimsBusinessError(result, request.info.id)
  if (businessError) {
    return h.response(businessError.body).code(businessError.statusCode)
  }

  if (!response.ok) {
    const error = normalizeUpstreamStatus(
      response.status,
      request.info.id,
      'LIMS could not save the draft.'
    )
    return h.response(error.body).code(error.statusCode)
  }

  if (typeof result?.draftSubmissionId !== 'string' || result.draftSubmissionId.length === 0) {
    const error = outcomeUnknown(request)
    return h.response(error.body).code(error.statusCode)
  }

  return h.response({ draftId: result.draftSubmissionId }).code(statusCode)
}

export const registerDraftRoutes = (server, limsClient) => {
  server.route([
    {
      method: 'POST',
      path: '/v1/drafts',
      options: { validate: { payload: draftBody } },
      handler: (request, h) => saveDraft(request, h, limsClient, 201)
    },
    {
      method: 'PUT',
      path: '/v1/drafts/{draftId}',
      options: {
        validate: {
          params: Joi.object({ draftId: Joi.string().trim().required() }),
          payload: draftBody
        }
      },
      handler: (request, h) => saveDraft(request, h, limsClient, 200)
    }
  ])
}
