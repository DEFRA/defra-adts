/**
 * Route-level tests for the Dashboard page layout.
 *
 * Verifies the GOV.UK service header (AC1) and the "New submission" section
 * (AC5) render correctly on the Dashboard route (GET /).
 *
 * Not covered here:
 * - AC2 (Home link in service header) — not implemented in current template.
 * - AC3 (Home link navigation) — blocked by AC2.
 * - AC4 (Post-login → Dashboard) — auth strategy not yet registered on the
 *   server. Will be added once auth is wired.
 *
 * @story DASH-01
 * @acs AC1, AC5
 */

import { expect } from '@hapi/code'
import Lab from '@hapi/lab'
import createServer from '../../src/app.js'

const lab = Lab.script()
export { lab }

lab.experiment('Dashboard Layout', () => {
  let server
  let html

  lab.before(async () => {
    process.env.LIMS_ADAPTER_URL = 'http://localhost:3100'
    server = await createServer()

    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).to.equal(200)
    html = response.payload
  })

  lab.after(async () => {
    await server.stop()
  })

  lab.experiment('GOV.UK service header', () => {
    lab.test('renders the GOV.UK header element', () => {
      expect(html).to.match(/<header[^>]*class="[^"]*govuk-header/)
    })

    lab.test('renders the GOV.UK logo (logotype)', () => {
      // GOV.UK Frontend 5.x emits either a .govuk-header__logotype class
      // or an SVG inside .govuk-header__logo
      expect(html).to.match(/govuk-header__logotype|govuk-header__logo/)
    })

    lab.test('displays the service name "Animal Disease Testing Service"', () => {
      expect(html).to.match(
        /class="[^"]*govuk-header__service-name[^"]*"[^>]*>\s*Animal Disease Testing Service\s*</
      )
    })
  })

  lab.experiment('New submission section', () => {
    lab.test('renders the "New submission" heading as h1', () => {
      expect(html).to.match(/<h1[^>]*class="[^"]*govuk-heading-l[^"]*"[^>]*>\s*New submission\s*<\/h1>/)
    })

    lab.test('displays guidance text explaining submission options', () => {
      expect(html).to.contain(
        'Start a new sick animal submission or healthy animal submission.'
      )
    })

    lab.test('renders the "Sick animal submission" button', () => {
      expect(html).to.match(/>\s*Sick animal submission\s*</)
    })

    lab.test('renders the "Healthy animal submission" button', () => {
      expect(html).to.match(/>\s*Healthy animal submission\s*</)
    })

    lab.test('"Sick animal submission" button is enabled (no disabled attribute)', () => {
      // Isolate the Sick button anchor (includes the start-icon SVG), then
      // assert disabled is absent. Non-greedy match across newlines.
      const match = html.match(
        /<a[^>]*role="button"[^>]*>[\s\S]*?Sick animal submission[\s\S]*?<\/a>/
      )
      expect(match).to.not.be.null()
      expect(match[0]).to.not.contain('disabled=')
      expect(match[0]).to.not.contain('aria-disabled="true"')
    })

    lab.test('"Healthy animal submission" button is enabled (no disabled attribute)', () => {
      const match = html.match(
        /<a[^>]*role="button"[^>]*>[\s\S]*?Healthy animal submission[\s\S]*?<\/a>/
      )
      expect(match).to.not.be.null()
      expect(match[0]).to.not.contain('disabled=')
      expect(match[0]).to.not.contain('aria-disabled="true"')
    })
  })
})
