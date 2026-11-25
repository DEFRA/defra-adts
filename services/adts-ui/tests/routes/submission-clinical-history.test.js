import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const url = '/submission-03-clinical-history'
const getCookieHeader = (response) => response.headers['set-cookie']?.[0]?.split(';')[0] || ''

describe('Submission clinical history page', () => {
  let server

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    server = await createServer()
  })

  beforeEach(() => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/drafts') {
        return new Response(JSON.stringify({
          draftId: '123e4567-e89b-12d3-a456-426614174000',
          revision: 1
        }), { status: 201 })
      }
      return new Response(JSON.stringify([
        { clientId: 101, name: 'Acme Farm', addressLine1: '1 Farm Road', postcode: 'L20 6EC', cph: '12/123/1234' }
      ]), { status: 200 })
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  afterAll(async () => {
    await server.stop()
  })

  const get = (headers = {}) => server.inject({ method: 'GET', url, headers })
  const post = (payload, headers = {}) => server.inject({ method: 'POST', url, payload, headers })
  const getSaved = (response) => server.inject({
    method: 'GET',
    url,
    headers: { cookie: getCookieHeader(response) }
  })

  const dateFields = (day, month, year) => ({
    'sampleTakenDate-day': day,
    'sampleTakenDate-month': month,
    'sampleTakenDate-year': year
  })
  const today = () => new Date().toISOString().slice(0, 10)

  test('renders a GOV.UK date input for day, month and year', async () => {
    const response = await get()

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('3. Clinical history')
    expect(response.payload).toContain('href="/submission-02-animal-details" class="govuk-back-link"')
    expect(response.payload).toContain('class="govuk-date-input"')
    expect(response.payload).toContain('Date the sample was taken')
    expect(response.payload).toContain('For example, 27 3 2007')
    expect(response.payload).toContain('name="sampleTakenDate-day"')
    expect(response.payload).toContain('name="sampleTakenDate-month"')
    expect(response.payload).toContain('name="sampleTakenDate-year"')
    expect(response.payload).not.toContain('type="date"')
    expect(response.payload).not.toContain('max=')
    expect(response.payload).not.toContain('date picker')
  })

  test('renders same-case contact fields conditionally and hides them by default', async () => {
    const response = await get()

    expect(response.payload).toContain('Have you contacted us about the same case?')
    expect(response.payload).toContain('value="no"')
    expect(response.payload).toContain('value="yes"')
    expect(response.payload).toContain('data-aria-controls="conditional-contactedAboutSameCase-2"')
    expect(response.payload).toContain('id="conditional-contactedAboutSameCase-2"')
    expect(response.payload).toContain('govuk-radios__conditional--hidden')
    expect(response.payload).toContain('Find the previous submission reference (optional)')
    expect(response.payload).toMatch(/<select[^>]*id="previousSubmissionReference"[^>]*name="previousSubmissionReference"/)
    expect(response.payload).toContain('/assets/css/accessible-autocomplete.min.css')
    expect(response.payload).toContain('How did you get in touch?')
    expect(response.payload).toContain('value="phone"')
    expect(response.payload).toContain('value="farmVisit"')
    expect(response.payload).toContain('type="checkbox"')
    expect(response.payload).toContain('name="contactMethods"')
  })

  test('loads reference options scoped to the saved client and farm', async () => {
    const fetchSpy = globalThis.fetch
    fetchSpy.mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/GetClients' ||
        requestUrl === 'http://localhost:3200/GetCounties') {
        return new Response('[]', { status: 200 })
      }
      if (requestUrl === 'http://localhost:3200/drafts') {
        return new Response(JSON.stringify({
          draftId: '123e4567-e89b-12d3-a456-426614174000',
          revision: 1
        }), { status: 201 })
      }
      if (requestUrl === 'http://localhost:3200/submission-references?clientName=Acme+Farm&clientFarm=North+Field') {
        return new Response(JSON.stringify(['SUB-123']), { status: 200 })
      }
      return new Response('{}', { status: 404 })
    })

    const start = await server.inject({
      method: 'GET',
      url: '/submission-01-client-details/start?type=sick'
    })
    const clientDetails = await server.inject({
      method: 'POST',
      url: '/submission-01-client-details',
      headers: { cookie: getCookieHeader(start) },
      payload: {
        manualClientEntry: 'yes',
        name: 'Acme Farm',
        farmName: 'North Field',
        addressLine1: '1 Farm Road',
        county: 'Dorset',
        postcode: 'AB1 2CD',
        cph: '12/123/1234',
        animalsAtClientAddress: 'yes'
      }
    })
    const response = await get({ cookie: getCookieHeader(clientDetails) })

    expect(response.statusCode).toBe(200)
    expect(fetchSpy).toHaveBeenCalledWith(
      'http://localhost:3200/submission-references?clientName=Acme+Farm&clientFarm=North+Field'
    )
    expect(response.payload).toContain('<option value="SUB-123">SUB-123</option>')
  })

  test('AC1: saves and restores both contact methods when Yes is selected', async () => {
    const response = await post({
      ...dateFields('', '', ''),
      contactedAboutSameCase: 'yes',
      previousSubmissionReference: '  ADTS-123  ',
      contactMethods: ['phone', 'farmVisit']
    })

    expect(response.statusCode).toBe(302)
    const revisit = await getSaved(response)
    expect(revisit.request.response.source.context.submissionFormState.formData.clinicalHistory)
      .toEqual({
        contactedAboutSameCase: 'yes',
        previousSubmissionReference: 'ADTS-123',
        contactMethods: ['phone', 'farmVisit']
      })
    expect(revisit.payload).toContain('<option value="ADTS-123" selected>ADTS-123</option>')
    expect(revisit.payload).toContain('value="phone" checked')
    expect(revisit.payload).toContain('value="farmVisit" checked')
    expect(revisit.payload).not.toContain('govuk-radios__conditional--hidden')
  })

  test('AC2: selecting No hides and clears the additional contact details', async () => {
    const yesResponse = await post({
      ...dateFields('', '', ''),
      contactedAboutSameCase: 'yes',
      previousSubmissionReference: 'ADTS-123',
      contactMethods: ['phone', 'farmVisit']
    })
    const noResponse = await post({
      ...dateFields('', '', ''),
      contactedAboutSameCase: 'no',
      previousSubmissionReference: 'ADTS-123',
      contactMethods: ['phone', 'farmVisit']
    }, { cookie: getCookieHeader(yesResponse) })

    expect(noResponse.statusCode).toBe(302)
    const revisit = await getSaved(noResponse)
    expect(revisit.request.response.source.context.submissionFormState.formData.clinicalHistory)
      .toEqual({ contactedAboutSameCase: 'no' })
    expect(revisit.payload).toContain('value="no" checked')
    expect(revisit.payload).toContain('govuk-radios__conditional--hidden')
  })

  test('AC1/AC3: combines the date parts and persists a valid date in ISO format', async () => {
    const response = await post(dateFields('29', '02', '2024'))

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-04-tests')
    const revisit = await getSaved(response)
    expect(revisit.request.response.source.context.submissionFormState.formData.clinicalHistory)
      .toEqual({ sampleTakenDate: '2024-02-29' })
    expect(revisit.request.response.source.context.submissionFormState).toMatchObject({
      draftId: '123e4567-e89b-12d3-a456-426614174000',
      draftRevision: 1
    })
    const saveRequest = globalThis.fetch.mock.calls.find(([requestUrl]) =>
      requestUrl === 'http://localhost:3200/drafts'
    )
    expect(JSON.parse(saveRequest[1].body)).toMatchObject({
      lastSavedPage: 'clinicalHistory',
      formData: { clinicalHistory: { sampleTakenDate: '2024-02-29' } }
    })
    expect(revisit.payload).toContain('name="sampleTakenDate-day" type="text" value="29"')
    expect(revisit.payload).toContain('name="sampleTakenDate-month" type="text" value="02"')
    expect(revisit.payload).toContain('name="sampleTakenDate-year" type="text" value="2024"')
  })

  test('pads single-digit day and month when storing the ISO date', async () => {
    const response = await post(dateFields('5', '3', '2024'))

    expect(response.statusCode).toBe(302)
    const revisit = await getSaved(response)
    expect(revisit.request.response.source.context.submissionFormState.formData.clinicalHistory)
      .toEqual({ sampleTakenDate: '2024-03-05' })
  })

  test.each([
    ['29', '2', '2023'],
    ['13', '13', '2024'],
    ['31', '4', '2024'],
    ['ab', '1', '2024'],
    ['1', '2', '24'],
    ['1', '2', '20245'],
    ['', '3', '2024'],
    ['5', '', '2024'],
    ['', '', '2024'],
    ['1', '1', '']
  ])('rejects invalid or incomplete date %s/%s/%s without saving it', async (day, month, year) => {
    const response = await post(dateFields(day, month, year))

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('class="govuk-error-summary')
    expect(response.payload).toContain('href="#sampleTakenDate-day"')
    expect(response.payload).toContain('Enter a real date for when the sample was taken')
    expect(response.payload).toContain('id="sampleTakenDate-error"')
    expect(response.payload.match(/Enter a real date for when the sample was taken/g)).toHaveLength(2)
    expect(response.request.response.source.context.submissionFormState.formData?.clinicalHistory)
      .toBeUndefined()
  })

  test('allows an empty date and removes a previously saved date when cleared', async () => {
    const first = await post(dateFields('30', '4', '2024'))
    const cleared = await post(dateFields('', '', ''), { cookie: getCookieHeader(first) })

    expect(cleared.statusCode).toBe(302)
    const revisit = await getSaved(cleared)
    expect(revisit.request.response.source.context.submissionFormState.formData.clinicalHistory)
      .toBeUndefined()
  })

  test('rejects a future date even when the form is submitted directly', async () => {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const [year, month, day] = tomorrow.toISOString().slice(0, 10).split('-')
    const response = await post(dateFields(day, month, year))

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('The sample date must be today or in the past')
    expect(response.request.response.source.context.submissionFormState.formData?.clinicalHistory)
      .toBeUndefined()
  })

  test('accepts today as the sample date', async () => {
    const [year, month, day] = today().split('-')
    const response = await post(dateFields(day, month, year))

    expect(response.statusCode).toBe(302)
  })

  test('does not advance when the backend cannot save clinical history', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    globalThis.fetch.mockImplementation(async (requestUrl) => {
      if (requestUrl === 'http://localhost:3200/drafts') {
        return new Response('Unavailable', { status: 502 })
      }
      return new Response(JSON.stringify([
        { clientId: 101, name: 'Acme Farm', addressLine1: '1 Farm Road', postcode: 'L20 6EC', cph: '12/123/1234' }
      ]), { status: 200 })
    })

    const response = await post(dateFields('', '', ''))

    expect(response.statusCode).toBe(502)
    expect(response.headers.location).toBeUndefined()
    expect(response.payload).toContain('We could not save your draft')
    expect(response.request.response.source.context.submissionFormState.draftId).toBeUndefined()
  })
})
