/**
 * Route-level tests for the /results page.
 *
 * Covers:
 * - DASH-03a: Submitted submission rendering (card + status tag + fields)
 * - DASH-03b: Draft submission rendering (orange tag + no-tests message)
 * - DASH-12 AC4: Submission count rendering above results
 * - Empty state rendering
 *
 * @story DASH-03a, DASH-03b, DASH-03d, DASH-03e, DASH-12
 */

import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('UI Results Card Rendering Integration Pipeline', () => {
  let server

  beforeAll(async () => {
    process.env.PORT = 3000
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    process.env.SESSION_SECRET = 'abcdefghijklmnopqrstuvwxyz123456'
    server = await createServer()
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
    expect(htmlOutput).toContain('href="/submissions/14-M0002-02-26"')
    expect(htmlOutput).toContain('View submission 14-M0002-02-26')
    expect(htmlOutput).toContain('app-tag--submitted')
    expect(htmlOutput).toContain('app-tag--overdue')
    expect(htmlOutput).toContain('APHA Carmarthen')
    expect(htmlOutput).toContain('OLD MCDONALD')
    expect(htmlOutput).toContain('ANIMAL FARM')
    expect(htmlOutput).toContain('Goat')
    expect(htmlOutput).toContain('Dave Simonds')
    expect(htmlOutput).toContain('12/Feb/2026')
  })

  test('should render result and PDF links when results are available', async () => {
    const mockLimsData = {
      results: [
        {
          id: '123456',
          statuses: ['In progress', 'Tests complete'],
          samplesTo: 'APHA Weybridge',
          client: 'BITTADON FARMS LTD',
          clientFarm: 'CHURCH FARM',
          species: 'Cattle',
          clinician: 'Arturas Puodziunas',
          orderSubmitted: '18/Sep/2026',
          pdfUrl: 'https://documents.example.gov/reports/123456.pdf',
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
      expect(url).toContain('status=tests_complete')
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?status=tests_complete'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('href="/test-result?id=123456"')
    expect(response.payload).toContain('govuk-tag--green')
    expect(response.payload).toContain('View results')
    expect(response.payload).toContain('In progress')
    expect(response.payload).toContain('href="https://documents.example.gov/reports/123456.pdf"')
    expect(response.payload).toContain('View PDF')
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

  test('should render a cancelled submission with the GOV.UK grey status tag', async () => {
    const mockLimsData = {
      results: [
        {
          id: '16-C0001-11-25',
          statuses: ['Cancelled'],
          samplesTo: 'APHA Starcross',
          client: 'SPOURS, L',
          clientFarm: 'TWIZELL FARM',
          species: 'Cattle',
          clinician: 'Jon Drake',
          orderSubmitted: '18/Nov/2025',
          hasTests: true,
          tests: [
            {
              name: 'Salmonella Culture (TC0025)',
              type: 'Culture',
              sampleType: 'Faeces',
              qty: '1'
            }
          ]
        }
      ],
      totalCount: 1
    }

    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?status=cancelled'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('16-C0001-11-25')
    expect(response.payload).toContain('govuk-tag--purple')
    expect(response.payload).toContain('Cancelled')
    expect(response.payload).toContain('Salmonella Culture (TC0025)')
    expect(response.payload).toContain('APHA Starcross')
  })

  test('should render all submissions when filtered by status=samples_overdue', async () => {
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
        },
        {
          id: '15-X0001-03-26',
          statuses: ['Submitted', 'Samples overdue'],
          samplesTo: 'APHA Weybridge',
          client: 'BITTADON FARMS LTD',
          clientFarm: 'CHURCH FARM',
          species: 'Cattle',
          clinician: 'Jon Drake',
          orderSubmitted: '18/Jan/2026',
          hasTests: true,
          tests: [
            {
              name: 'Salmonella Culture (TC0025)',
              type: 'Culture',
              sampleType: 'Faeces',
              qty: '1'
            }
          ]
        }
      ],
      totalCount: 2
    }

    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      expect(url).toContain('status=samples_overdue')
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?status=samples_overdue'
    })

    expect(response.statusCode).toBe(200)
    expect(response.payload).toContain('2 submissions matching criteria')
    expect(response.payload).toContain('14-M0002-02-26')
    expect(response.payload).toContain('15-X0001-03-26')
    expect(response.payload).toContain('View submission 14-M0002-02-26')
    expect(response.payload).toContain('View submission 15-X0001-03-26')
    const overdueMatches = (response.payload.match(/app-tag--overdue/g) || []).length
    expect(overdueMatches).toBe(2)
    const submittedMatches = (response.payload.match(/app-tag--submitted/g) || []).length
    expect(submittedMatches).toBe(2)
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
