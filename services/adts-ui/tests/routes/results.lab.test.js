/**
 * Route-level tests for the /results page.
 *
 * Covers:
 * - DASH-03a: Submitted submission rendering (card + status tag + fields)
 * - DASH-03b: Draft submission rendering (orange tag + no-tests message)
 * - DASH-12 AC4: Submission count rendering above results
 * - Empty state rendering
 *
 * @story DASH-03a, DASH-03b, DASH-12
 */

import { expect } from '@hapi/code'
import Lab from '@hapi/lab'
import { mock } from 'node:test'
import createServer from '../../src/app.js'
const lab = Lab.script()
export { lab }

lab.experiment('UI Results Card Rendering Integration Pipeline', () => {
  let server

  lab.before(async () => {
    server = await createServer()
  })

  lab.after(async () => {
    await server.stop()
  })

  lab.afterEach(() => {
    mock.reset()
  })

  lab.test('should accurately bind LIMS adapter payloads into GOV.UK layout elements', async () => {
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

    mock.method(global, 'fetch', async (url) => {
      expect(url).to.contain('/submissions')
      expect(url).to.contain('client=OLD')
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?client=OLD+MCDONALD'
    })

    expect(response.statusCode).to.equal(200)

    const htmlOutput = response.payload

    expect(htmlOutput).to.contain('Submission search results')
    expect(htmlOutput).to.contain('1 submissions matching criteria')
    expect(htmlOutput).to.contain('14-M0002-02-26')
    expect(htmlOutput).to.contain('href="/submissions/14-M0002-02-26"')
    expect(htmlOutput).to.contain('View submission 14-M0002-02-26')
    expect(htmlOutput).to.contain('app-tag--submitted')
    expect(htmlOutput).to.contain('app-tag--overdue')
    expect(htmlOutput).to.contain('APHA Carmarthen')
    expect(htmlOutput).to.contain('OLD MCDONALD')
    expect(htmlOutput).to.contain('ANIMAL FARM')
    expect(htmlOutput).to.contain('Goat')
    expect(htmlOutput).to.contain('Dave Simonds')
    expect(htmlOutput).to.contain('12/Feb/2026')
  })

  lab.test('should render result and PDF links for an in-progress submission', async () => {
    const mockLimsData = {
      results: [
        {
          id: '123456',
          statuses: ['In Progress'],
          samplesTo: 'APHA Weybridge',
          client: 'BITTADON FARMS LTD',
          clientFarm: 'CHURCH FARM',
          species: 'Cattle',
          clinician: 'Arturas Puodziunas',
          orderSubmitted: '18/Sep/2026',
          pdfUrl: 'https://documents.example.gov/reports/123456.pdf',
          hasTests: false,
          tests: []
        }
      ],
      totalCount: 1
    }

    mock.method(global, 'fetch', async (url) => {
      expect(url).to.contain('status=in_progress')
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?status=in_progress'
    })

    expect(response.statusCode).to.equal(200)
    expect(response.payload).to.contain('href="/test-result?id=123456"')
    expect(response.payload).to.contain('View results')
    expect(response.payload).to.contain('href="https://documents.example.gov/reports/123456.pdf"')
    expect(response.payload).to.contain('View PDF')
  })

  lab.test('should render a draft submission with its draft status and no-tests message', async () => {
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

    mock.method(global, 'fetch', async (url) => {
      expect(url).to.contain('status=draft')
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?status=draft'
    })

    expect(response.statusCode).to.equal(200)
    expect(response.payload).to.contain('Draft Id: 4457')
    expect(response.payload).to.contain('govuk-tag--orange')
    expect(response.payload).to.contain('Submission contains no tests.')
  })

  lab.test('should render a clear empty state block if LIMS adapter query results are empty', async () => {
    mock.method(global, 'fetch', async () => {
      return new Response(JSON.stringify({ results: [], totalCount: 0 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?client=NonExistent'
    })

    expect(response.statusCode).to.equal(200)
    expect(response.payload).to.contain('0 submissions matching criteria')
    expect(response.payload).to.contain('No records found matching your query criteria.')
  })
})
