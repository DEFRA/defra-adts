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

import { afterAll, beforeAll, describe, expect, test } from '@jest/globals'
import createServer from '../../src/app.js'

describe('Dashboard Layout', () => {
  let server
  let html

  beforeAll(async () => {
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    process.env.SUBMISSIONS_SERVICE_URL = 'http://localhost:3100'
    server = await createServer()

    const response = await server.inject({
      method: 'GET',
      url: '/'
    })

    expect(response.statusCode).toBe(200)
    html = response.payload
  })

  afterAll(async () => {
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

    test('renders the "Sick animal submission" button', () => {
      expect(html).toMatch(/>\s*Sick animal submission\s*</)
    })

    test('renders the "Healthy animal submission" button', () => {
      expect(html).toMatch(/>\s*Healthy animal submission\s*</)
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

    test('"Sick animal submission" button is enabled (no disabled attribute)', () => {
      // Isolate the Sick button anchor (includes the start-icon SVG), then
      // assert disabled is absent. Non-greedy match across newlines.
      const match = html.match(
        /<a[^>]*role="button"[^>]*>[\s\S]*?Sick animal submission[\s\S]*?<\/a>/
      )
      expect(match).not.toBeNull()
      expect(match[0]).not.toContain('disabled=')
      expect(match[0]).not.toContain('aria-disabled="true"')
    })

    test('"Healthy animal submission" button is enabled (no disabled attribute)', () => {
      const match = html.match(
        /<a[^>]*role="button"[^>]*>[\s\S]*?Healthy animal submission[\s\S]*?<\/a>/
      )
      expect(match).not.toBeNull()
      expect(match[0]).not.toContain('disabled=')
      expect(match[0]).not.toContain('aria-disabled="true"')
    })
  })
})
