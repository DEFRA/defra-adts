/**
 * Component tests for the Dashboard submission-management section.
 *
 * Verifies the section heading, filter controls, and Search action render
 * correctly from the Nunjucks template, in isolation from the Hapi server.
 *
 * Not covered here (owned elsewhere):
 * - Filter value pre-population → dashboard-filter-prepopulation.test.js
 * - XSS escaping → dashboard-filter-security.test.js
 * - Primary page landmarks (header + New submission) → DASH-01 route test
 *   (services/adts-ui/tests/routes/dashboard-layout.lab.test.js)
 * - Status dropdown options → dashboard-filter-statuses.test.js
 *
 * @story DASH-12
 * @acs AC1, AC2, AC3
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import nunjucks from 'nunjucks'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Dashboard submission-management section (DASH-12)', () => {
  let env

  beforeAll(() => {
    env = nunjucks.configure(
      [
        path.resolve(__dirname, '../../src/views'),
        path.resolve(__dirname, '../../node_modules/govuk-frontend/dist')
      ],
      { autoescape: true, throwOnUndefined: false }
    )
  })

  const defaultContext = {
    filteredValues: { client: '', clinician: '', status: 'show_all', submitted_date: '' }
  }

  describe('AC1: Submission management section heading', () => {
    it('renders the heading "View completed submissions or edit draft submissions"', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toContain('View completed submissions or edit draft submissions')
    })

    it('renders the heading as h2 with the correct GOV.UK class', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(
        /<h2[^>]*class="[^"]*govuk-heading-l[^"]*"[^>]*>\s*View completed submissions or edit draft submissions\s*<\/h2>/
      )
    })
  })

  describe('AC2: Filter controls', () => {
    it('renders Client input with correct name attribute and label', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<input[^>]*name="client"/i)
      expect(html).toMatch(/<label[^>]*>\s*Client\s*<\/label>/)
    })

    it('renders Clinician input with correct name attribute and label', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<input[^>]*name="clinician"/i)
      expect(html).toMatch(/<label[^>]*>\s*Clinician\s*<\/label>/)
    })

    it('renders Status as a select element with label', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<select[^>]*name="status"/i)
      expect(html).toMatch(/<label[^>]*>\s*Status\s*<\/label>/)
    })

    it('renders Submitted date as a select element with label', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<select[^>]*name="submitted-date"/i)
      expect(html).toMatch(/<label[^>]*>\s*Submitted date\s*<\/label>/)
    })

    it('renders all required labels inside the "Filter submissions by" section', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toContain('Filter submissions by')
      expect(html).toMatch(/<label[^>]*>\s*Client\s*<\/label>/)
      expect(html).toMatch(/<label[^>]*>\s*Clinician\s*<\/label>/)
      expect(html).toMatch(/<label[^>]*>\s*Status\s*<\/label>/)
      expect(html).toMatch(/<label[^>]*>\s*Submitted date\s*<\/label>/)
    })
  })

  describe('AC3: Search action', () => {
    it('renders a Search submit button', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*?Search[\s\S]*?<\/button>/)
    })

    it('filter form submits to /results via GET', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<form[^>]*method="get"[^>]*action="\/results"/)
    })
  })
})
