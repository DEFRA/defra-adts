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
    // 1. Structural mock response containing live reference keys matching your specification
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

    // 2. Intercept the outbound web request layer natively
    mock.method(global, 'fetch', async (url) => {
      expect(url).to.contain('/submissions')
      expect(url).to.contain('client=OLD')
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    // 3. Inject simulated form search submit criteria directly into the route lifecycle
    const response = await server.inject({
      method: 'GET',
      url: '/results?client=OLD+MCDONALD'
    })

    expect(response.statusCode).to.equal(200)

    const htmlOutput = response.payload

    // 4. Assert summary total headers are rendering values properly
    expect(htmlOutput).to.contain('Submission search results')
    expect(htmlOutput).to.contain('1 submissions matching criteria')

    // 5. Assert reference ID values match layout block requirements
    expect(htmlOutput).to.contain('14-M0002-02-26')

    // 6. Assert dynamic status color coding elements render cleanly
    expect(htmlOutput).to.contain('app-tag--submitted')
    expect(htmlOutput).to.contain('app-tag--overdue')
    // 7. Assert multi-column core grid data cells map cleanly
    expect(htmlOutput).to.contain('APHA Carmarthen')
    expect(htmlOutput).to.contain('OLD MCDONALD')
    expect(htmlOutput).to.contain('ANIMAL FARM')
    expect(htmlOutput).to.contain('Goat')
    expect(htmlOutput).to.contain('Dave Simonds')
    expect(htmlOutput).to.contain('12/Feb/2026')
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
