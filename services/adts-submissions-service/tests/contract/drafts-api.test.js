import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'
import { draftBody } from '../../src/routes/drafts.js'
import { loadConfig } from '../../src/config.js'

const config = loadConfig({
  LIMS_BASE_URL: 'https://lims.example.test',
  LIMS_PREFIX: 'api',
  LIMS_TIMEOUT_MS: '1000'
})

const validDraft = () => ({
  draftSubmissionId: null,
  submissionType: 'DIAG',
  pvsId: 'PVS001',
  clientName: 'Synthetic Client',
  clientFarm: 'Sample Farm',
  clientAddress: 'Main Road, Sampleton',
  clientPostcode: 'AA1 1AA',
  clientCounty: 'Test County',
  clientSubCounty: null,
  clientCPHH: '00-000-0000',
  clinician: 'Test Vet',
  resultsReadyConfirmationEmail: '',
  resultsReadyConfirmationPhoneNumber: '',
  areAnimalsAtFarmAddress: true,
  animalCPHH: '',
  animalFarm: '',
  animalAddress: '',
  animalPostcode: '',
  animalCounty: '',
  animalSubCounty: '',
  animalSpeciesId: 'CATTLE',
  animalBreedId: 'BREED-1',
  animals: [{ id: 0, name: '001' }],
  animalSexId: 'MALE',
  animalAgeId: 'ADULT',
  ageDetail: '3',
  ageIndicator: 'YEARS',
  ageIsEstimate: false,
  animalOrganicId: '',
  animalPurposeId: 'SUCKLER',
  animalHousingId: 'OUTDOOR',
  dateSamplesTaken: '28/10/2026',
  previousSubmissionId: '',
  previousSubmissionContactByPhone: false,
  previousSubmissionContactByAphaFarmVisit: false,
  herdTotal: '100',
  herdBreedingTotal: '100',
  herdAffectedTotal: '2',
  herdAffectedIncDead: '2',
  herdDeadTotal: '0',
  clinicalSign1Id: 'MALAISE',
  clinicalSign2Id: '',
  clinicalSign3Id: '',
  clinicalSignDurationId: '0_3',
  clinicalHistory: 'Synthetic clinical history',
  products: [{
    productId: 'PC0203',
    productType: 'TEST',
    isFOP: false,
    isSOP: false,
    animalSamples: [{ animalId: 0, animalName: '001', sampleId: 'S-001', poolGroup: null }],
    sampleTypes: [{ packageProductId: '', sampleType: 'SERUM' }],
    options: []
  }],
  samplesWillSendToSeparateAddresses: false,
  canUseSurveillance: false,
  cancelSubmission: null,
  masterSubmissionId: null,
  linkedFirstOfPairSubmissionId: null,
  sendersReference: 'SYNTHETIC-REF'
})

const jsonResponse = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' }
})

describe('LIMS draft create and update API', () => {
  let server
  let limsClient

  beforeAll(async () => {
    limsClient = { request: jest.fn() }
    server = await createServer({ config, limsClient })
  })

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    limsClient.request.mockReset()
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  test('accepts a source-shaped 52-key legacy payload', () => {
    const { error } = draftBody.validate(validDraft())
    expect(error).toBeUndefined()
  })

  test('sends the complete legacy payload and returns the mapped draft ID', async () => {
    const draft = validDraft()
    limsClient.request.mockResolvedValue(jsonResponse({ draftSubmissionId: '101' }))

    const response = await server.inject({
      method: 'POST',
      url: '/v1/drafts',
      payload: draft
    })

    expect(response.statusCode).toBe(201)
    expect(response.result).toEqual({ draftId: '101' })
    expect(limsClient.request).toHaveBeenCalledTimes(1)
    expect(limsClient.request).toHaveBeenCalledWith('submissions/createUpdateDraftSubmission', {
      method: 'POST',
      body: draft
    })
    expect(Object.keys(limsClient.request.mock.calls[0][1].body)).toHaveLength(52)
  })

  test('rejects missing or extra top-level fields before contacting LIMS', async () => {
    const missingField = validDraft()
    delete missingField.herdTotal
    const extraField = { ...validDraft(), submissionId: 'SHOULD-NOT-BE-SENT' }

    const missingResponse = await server.inject({ method: 'POST', url: '/v1/drafts', payload: missingField })
    const extraResponse = await server.inject({ method: 'POST', url: '/v1/drafts', payload: extraField })

    expect(missingResponse.statusCode).toBe(400)
    expect(extraResponse.statusCode).toBe(400)
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('rejects invalid clinician length and nested product sample data', async () => {
    const longClinician = { ...validDraft(), clinician: 'x'.repeat(1001) }
    const invalidSample = validDraft()
    invalidSample.products[0].animalSamples[0].animalId = -1

    const clinicianResponse = await server.inject({ method: 'POST', url: '/v1/drafts', payload: longClinician })
    const sampleResponse = await server.inject({ method: 'POST', url: '/v1/drafts', payload: invalidSample })

    expect(clinicianResponse.statusCode).toBe(400)
    expect(sampleResponse.statusCode).toBe(400)
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('returns an indeterminate outcome if LIMS does not return a draft ID', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({ status: 'accepted' }))

    const response = await server.inject({ method: 'POST', url: '/v1/drafts', payload: validDraft() })

    expect(response.statusCode).toBe(504)
    expect(response.result.category).toBe('outcome_unknown')
    expect(limsClient.request).toHaveBeenCalledTimes(1)
  })

  test('returns an indeterminate outcome if LIMS returns an empty draft ID', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({ draftSubmissionId: '' }))

    const response = await server.inject({ method: 'POST', url: '/v1/drafts', payload: validDraft() })

    expect(response.statusCode).toBe(504)
    expect(response.result.category).toBe('outcome_unknown')
    expect(limsClient.request).toHaveBeenCalledTimes(1)
  })

  test('returns an indeterminate outcome after a timeout and never retries the create', async () => {
    limsClient.request.mockRejectedValue(new DOMException('timeout', 'TimeoutError'))

    const response = await server.inject({ method: 'POST', url: '/v1/drafts', payload: validDraft() })

    expect(response.statusCode).toBe(504)
    expect(response.result.category).toBe('outcome_unknown')
    expect(limsClient.request).toHaveBeenCalledTimes(1)
  })

  test('returns an indeterminate outcome when the LIMS response is invalid JSON', async () => {
    limsClient.request.mockResolvedValue(new Response('not json', { status: 200 }))

    const response = await server.inject({ method: 'POST', url: '/v1/drafts', payload: validDraft() })

    expect(response.statusCode).toBe(504)
    expect(response.result.category).toBe('outcome_unknown')
    expect(limsClient.request).toHaveBeenCalledTimes(1)
  })

  test('preserves LIMS draft-save business errors', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({
      hasErrors: true,
      code: 'DRAFT_REJECTED',
      errorMessages: ['token=secret-value']
    }))

    const response = await server.inject({ method: 'POST', url: '/v1/drafts', payload: validDraft() })

    expect(response.statusCode).toBe(422)
    expect(response.result.category).toBe('business_error')
    expect(response.result.upstreamMessages).toEqual(['[REDACTED]'])
    expect(JSON.stringify(response.result)).not.toContain('secret-value')
  })

  test('normalizes LIMS HTTP errors without returning the upstream body', async () => {
    limsClient.request.mockResolvedValue(jsonResponse({ secret: 'private upstream detail' }, 500))

    const response = await server.inject({ method: 'POST', url: '/v1/drafts', payload: validDraft() })

    expect(response.statusCode).toBe(502)
    expect(response.result.category).toBe('upstream_http_error')
    expect(JSON.stringify(response.result)).not.toContain('private upstream detail')
  })

  test('rejects an update whose path ID differs from the payload draft ID', async () => {
    const draft = { ...validDraft(), draftSubmissionId: '102' }

    const response = await server.inject({ method: 'PUT', url: '/v1/drafts/101', payload: draft })

    expect(response.statusCode).toBe(400)
    expect(response.result.category).toBe('validation_error')
    expect(limsClient.request).not.toHaveBeenCalled()
  })

  test('updates an existing draft using the requested ID', async () => {
    const draft = { ...validDraft(), draftSubmissionId: '101' }
    limsClient.request.mockResolvedValue(jsonResponse({ draftSubmissionId: '101' }))

    const response = await server.inject({
      method: 'PUT',
      url: '/v1/drafts/101',
      payload: draft
    })

    expect(response.statusCode).toBe(200)
    expect(response.result).toEqual({ draftId: '101' })
    expect(limsClient.request).toHaveBeenCalledWith('submissions/createUpdateDraftSubmission', {
      method: 'POST',
      body: draft
    })
  })
})
