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
import path from 'node:path'
import * as sass from 'sass'
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
    test('renders the new submission subheading and guidance', () => {
      expect(html).toMatch(/<h2[^>]*>\s*New submission\s*<\/h2>/)
      expect(html).toContain('Start a new sick animal submission or healthy animal submission.')
      expect(html).not.toContain('>Clients<')
    })

    test('renders the submission actions as GOV.UK styled link buttons', () => {
      const actions = [...html.matchAll(/<a\b[^>]*href="\/submission-01-client-details"[^>]*>[\s\S]*?<\/a>/g)]
        .map(([link]) => link)

      expect(actions).toHaveLength(2)
      for (const action of actions) {
        expect(action).toContain('role="button"')
        expect(action).toContain('draggable="false"')
        expect(action).toContain('data-module="govuk-button"')
        expect(action).toMatch(/class="[^"]*\bgovuk-button\b/)
        expect(action).toContain('govuk-button--start')
        expect(action).toContain('govuk-button__start-icon')
        expect(action).not.toContain('class="govuk-link"')
      }
      expect(actions[0]).toContain('app-button--sick')
      expect(actions[0]).toContain('Sick animal submission')
      expect(actions[1]).toContain('app-button--healthy')
      expect(actions[1]).toContain('Healthy animal submission')
      expect(html).toMatch(/<div class="govuk-button-group">\s*<a[^>]*app-button--sick/)
    })

    test('styles healthy as the brand colour and sick as yellow tint 25%', () => {
      const { css } = sass.compile(
        path.join(process.cwd(), 'src/assets/scss/application.scss'),
        { loadPaths: [path.join(process.cwd(), 'node_modules')], style: 'compressed', quietDeps: true, silenceDeprecations: ['import', 'global-builtin', 'color-functions'] }
      )

      expect(css).toMatch(/\.app-button--healthy\{background-color:#1d70b8;color:#fff/)
      expect(css).toMatch(/\.app-button--sick\{background-color:#ffe640;color:#0b0c0c/)
    })

    test('both submission links navigate to the client details page', async () => {
      for (const linkText of ['Sick animal submission', 'Healthy animal submission']) {
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

    test('renders the completed and draft submissions subheading', () => {
      expect(html).toMatch(/<h2[^>]*>\s*View completed submissions or edit draft submissions\s*<\/h2>/)
    })

    test('does not render standalone client create or update links', () => {
      expect(html).not.toContain('href="/create-client"')
      expect(html).not.toContain('href="/update-client"')
      expect(html).not.toContain('govuk-!-font-size-24')
      expect(html).not.toContain('govuk-list--bullet')
      expect(html).not.toContain('govuk-link--no-underline')
    })
  })
})
