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
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([
      { clientId: 101, name: 'Acme Farm', addressLine1: '1 Farm Road', postcode: 'L20 6EC', cph: '12/123/1234' }
    ]), { status: 200 }))
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

  test('renders a native date input with its maximum set to today', async () => {
    const response = await get()

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('3. Clinical history')
    expect(response.payload).toContain('href="/submission-02-animal-details" class="govuk-back-link"')
    expect(response.payload).toContain('Date the sample was taken')
    expect(response.payload).toContain('type="date"')
    expect(response.payload).toContain('name="sampleTakenDate"')
    expect(response.payload).toContain(`max="${new Date().toISOString().slice(0, 10)}"`)
  })

  test('AC1/AC3: accepts and persists a valid date in ISO format', async () => {
    const response = await post({ sampleTakenDate: '2024-02-29' })

    expect(response.statusCode).toBe(302)
    expect(response.headers.location).toBe('/submission-04-tests')
    const revisit = await getSaved(response)
    expect(revisit.request.response.source.context.submissionFormState.formData.clinicalHistory)
      .toEqual({ sampleTakenDate: '2024-02-29' })
    expect(revisit.payload).toContain('type="date"')
    expect(revisit.payload).toContain('value="2024-02-29"')
  })

  test.each([
    ['2023-02-29', 'real date'],
    ['2024-13-01', 'real date'],
    ['2024-04-31', 'real date'],
    ['2024-4-30', 'real date'],
    ['2024/04/30', 'real date']
  ])('rejects invalid input %j without saving it', async (payload, errorMessage) => {
    const response = await post({ sampleTakenDate: payload })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('class="govuk-error-summary')
    expect(response.payload).toContain('href="#sampleTakenDate"')
    expect(response.payload).toContain(errorMessage)
    expect(response.payload).toContain('id="sampleTakenDate-error"')
    expect(response.payload.match(new RegExp(errorMessage, 'g'))).toHaveLength(2)
    expect(response.request.response.source.context.submissionFormState.formData?.clinicalHistory)
      .toBeUndefined()
  })

  test('allows an empty date and removes a previously saved date when cleared', async () => {
    const first = await post({ sampleTakenDate: '2024-04-30' })
    const cleared = await post({}, { cookie: getCookieHeader(first) })

    expect(cleared.statusCode).toBe(302)
    const revisit = await getSaved(cleared)
    expect(revisit.request.response.source.context.submissionFormState.formData.clinicalHistory)
      .toBeUndefined()
  })

  test('rejects a future date even when the browser max attribute is bypassed', async () => {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const futureDate = tomorrow.toISOString().slice(0, 10)
    const response = await post({ sampleTakenDate: futureDate })

    expect(response.statusCode).toBe(400)
    expect(response.payload).toContain('The sample date must be today or in the past')
    expect(response.payload).toContain(`max="${new Date().toISOString().slice(0, 10)}"`)
  })
})
