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

import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Dashboard Layout', () => {
  let server
  let html

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify([]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }))
    server = await createServer()

    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).toBe(200)
    html = response.payload
  })

  afterAll(async () => {
    jest.restoreAllMocks()
    await server.stop()
  })

  describe('GOV.UK service header', () => {
    test('renders the GOV.UK header element', () => {
      expect(html).toMatch(/<header[^>]*class="[^"]*govuk-header/)
    })

    test('renders the GOV.UK logo (logotype)', () => {
      // GOV.UK Frontend 5.x emits either a .govuk-header__logotype class
      // or an SVG inside .govuk-header__logo
      expect(html).toMatch(/govuk-header__logotype|govuk-header__logo/)
    })

    test('displays the service name "Animal Disease Testing Service"', () => {
      expect(html).toMatch(
        /class="[^"]*govuk-header__service-name[^"]*"[^>]*>\s*Animal Disease Testing Service\s*</
      )
    })
  })

  describe('New submission section', () => {
    test('renders the "New submission" heading as h1', () => {
      expect(html).toMatch(/<h1[^>]*class="[^"]*govuk-heading-l[^"]*"[^>]*>\s*New submission\s*<\/h1>/)
    })

    test('displays guidance text explaining submission options', () => {
      expect(html).toContain(
        'Start a new sick animal submission or healthy animal submission.'
      )
    })

    test('renders "Sick animal submission" as a GOV.UK homepage link', () => {
      expect(html).toMatch(/>\s*Sick animal submission\s*</)
      expect(html).toMatch(/<a class="govuk-link govuk-!-font-size-24" href="\/submission-01-client-details">Sick animal submission<\/a>/)
    })

    test('renders "Healthy animal submission" as a GOV.UK homepage link', () => {
      expect(html).toMatch(/>\s*Healthy animal submission\s*</)
      expect(html).toMatch(/<a class="govuk-link govuk-!-font-size-24" href="\/submission-01-client-details">Healthy animal submission<\/a>/)
    })

    test('both submission buttons navigate to the client details page', async () => {
      for (const buttonText of ['Sick animal submission', 'Healthy animal submission']) {
        const button = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
          .find(([, , content]) => content.includes(buttonText))

        expect(button).toBeDefined()
        expect(button[1]).toContain('href="/submission-01-client-details"')
      }

      const destinationResponse = await server.inject({
        method: 'GET',
        url: '/submission-01-client-details'
      })

      expect(destinationResponse.statusCode).toBe(200)
      expect(destinationResponse.payload).toContain('1. Client details')
    })

    test('renders separate create and update client links', () => {
      expect(html).toMatch(/<a class="govuk-link govuk-!-font-size-24" href="\/create-client">Create a new client<\/a>/)
      expect(html).toMatch(/<a class="govuk-link govuk-!-font-size-24" href="\/update-client">Update an existing client's details<\/a>/)
    })
  })
})
