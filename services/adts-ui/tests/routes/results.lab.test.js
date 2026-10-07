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
    expect(htmlOutput).to.contain('app-tag--submitted')
    expect(htmlOutput).to.contain('app-tag--overdue')
    expect(htmlOutput).to.contain('APHA Carmarthen')
    expect(htmlOutput).to.contain('OLD MCDONALD')
    expect(htmlOutput).to.contain('ANIMAL FARM')
    expect(htmlOutput).to.contain('Goat')
    expect(htmlOutput).to.contain('Dave Simonds')
    expect(htmlOutput).to.contain('12/Feb/2026')
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

  lab.test('should render a cancelled submission with the GOV.UK grey status tag', async () => {
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

    mock.method(global, 'fetch', async () => {
      return new Response(JSON.stringify(mockLimsData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const response = await server.inject({
      method: 'GET',
      url: '/results?status=cancelled'
    })

    expect(response.statusCode).to.equal(200)
    expect(response.payload).to.contain('16-C0001-11-25')
    expect(response.payload).to.contain('govuk-tag--purple')
    expect(response.payload).to.contain('Cancelled')
    expect(response.payload).to.contain('Salmonella Culture (TC0025)')
    expect(response.payload).to.contain('APHA Starcross')
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
