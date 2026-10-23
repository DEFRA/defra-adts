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

  describe('Homepage links', () => {
    test('does not render redundant submission or client headings', () => {
      expect(html).not.toContain('New submission')
      expect(html).not.toContain('>Clients<')
    })

    test('does not display redundant guidance text for the submission links', () => {
      expect(html).not.toContain('Start a new sick animal submission or healthy animal submission.')
    })

    test('renders the homepage actions as stacked GOV.UK buttons', () => {
      const actions = [...html.matchAll(/<li>\s*(<a\b[^>]*role="button"[^>]*>[\s\S]*?<\/a>)\s*<\/li>/g)]
        .map(([, button]) => button)

      expect(actions).toHaveLength(4)
      expect(actions[0]).toContain('class="govuk-button"')
      expect(actions[0]).toContain('href="/submission-01-client-details"')
      expect(actions[0]).toContain('Create a sick animal submission')
      expect(actions[1]).toContain('Create a healthy animal submission')
      expect(actions[2]).toContain('href="/create-client"')
      expect(actions[2]).toContain('Create a new client')
      expect(actions[3]).toContain('href="/update-client"')
      expect(actions[3]).toContain('Update an existing client&#39;s details')
    })

    test('both submission links navigate to the client details page', async () => {
      for (const linkText of ['Create a sick animal submission', 'Create a healthy animal submission']) {
        const link = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
          .find(([, , content]) => content.includes(linkText))

        expect(link).toBeDefined()
        expect(link[1]).toContain('href="/submission-01-client-details"')
      }

      const destinationResponse = await server.inject({
        method: 'GET',
        url: '/submission-01-client-details'
      })

      expect(destinationResponse.statusCode).toBe(200)
      expect(destinationResponse.payload).toContain('1. Client details')
    })

    test('renders separate create and update client action buttons', () => {
      expect(html).toContain('href="/create-client"')
      expect(html).toContain('Create a new client')
      expect(html).toContain('href="/update-client"')
      expect(html).toContain('Update an existing client&#39;s details')
      expect(html).not.toContain('govuk-!-font-size-24')
      expect(html).not.toContain('govuk-list--bullet')
      expect(html).not.toContain('govuk-link--no-underline')
    })
  })
})
