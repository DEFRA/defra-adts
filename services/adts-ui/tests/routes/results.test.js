import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('UI Results Card Rendering Integration Pipeline', () => {
  let server

  beforeAll(async () => {
    server = await createServer({ port: 9181, sessionSecret: 'jcgBvzmcBdLDIorYTvedmnNqIiiHIiymBokR', limsAdapterUrl: 'http://localhost:9180' })
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('should accurately bind LIMS adapter payloads into GOV.UK layout elements', async () => {
    const mockLimsData = {
      results: [
        {
          id: '14-M0002-02-26',
          statuses: ['Submitted', 'Samples overdue'],
          samplesTo: 'APHA Carmarthen',
          client: 'OLD MCDONALD',
          clientFarm: 'ANIMAL FARM',
          species: 'Goat',
          clinician: 'Dave Simonds',
          orderSubmitted: '12/Feb/2026',
          hasTests: true,
          tests: [
            {
              name: 'Worm egg and/or Cocc. Oocyst Count (TC0060)',
              type: 'McMaster method',
              sampleType: 'Caecal Contents',
              qty: '1'
            }
          ]
        }
      ],
      totalCount: 1
    }

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('/submissions')
      expect(url).toContain('client=OLD')
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?client=OLD+MCDONALD'
    })

    expect(response.statusCode).toBe(200)

    const htmlOutput = response.payload

    expect(htmlOutput).toContain('Submission search results')
    expect(htmlOutput).toContain('1 submissions matching criteria')
    expect(htmlOutput).toContain('14-M0002-02-26')
    expect(htmlOutput).toContain('app-tag--submitted')
    expect(htmlOutput).toContain('app-tag--overdue')
    expect(htmlOutput).toContain('APHA Carmarthen')
    expect(htmlOutput).toContain('OLD MCDONALD')
    expect(htmlOutput).toContain('ANIMAL FARM')
    expect(htmlOutput).toContain('Goat')
    expect(htmlOutput).toContain('Dave Simonds')
    expect(htmlOutput).toContain('12/Feb/2026')
  })

  test('should render a draft submission with its draft status and no-tests message', async () => {
    const mockLimsData = {
      results: [
        {
          id: '4457',
          statuses: ['Draft'],
          samplesTo: '---',
          client: '---',
          clientFarm: '---',
          species: '---',
          clinician: '---',
          orderSubmitted: '---',
          hasTests: false,
          tests: []
        }
      ],
      totalCount: 1
    }

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('status=draft')
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?status=draft'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('Draft Id: 4457')
    expect(response.payload).toContain('govuk-tag--orange')
    expect(response.payload).toContain('Submission contains no tests.')
  })

  test('should render a clear empty state block if LIMS adapter query results are empty', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ results: [], totalCount: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?client=NonExistent'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('0 submissions matching criteria')
    expect(response.payload).toContain('No records found matching your query criteria.')
  })
})
