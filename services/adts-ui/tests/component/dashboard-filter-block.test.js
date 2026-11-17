/**
 * Component tests for the Dashboard submission-management section.
 *
 * Verifies the filter form heading, controls, and Search action render
 * correctly from the Nunjucks macro, in isolation from the Hapi server.
 *
 * Not covered here (owned elsewhere):
 * - Filter value pre-population → dashboard-filter-prepopulation.test.js
 * - XSS escaping → dashboard-filter-security.test.js
 * - Dashboard page layout and landmarks → DASH-01 route test
 *   (services/adts-ui/tests/routes/dashboard-layout.test.js)
 * - Status dropdown options → dashboard-filter-statuses.test.js
 *
 * @story DASH-12
 * @acs AC2, AC3
 */

import { describe, it, expect } from '@jest/globals'
import { renderSubmissionSearchForm } from './helpers/nunjucks.js'

describe('Dashboard submission filters (DASH-12)', () => {
  const defaultFilteredValues = {
    client: '',
    clinician: '',
    status: 'show_all',
    submitted_date: ''
  }

  describe('AC2: Filter controls', () => {
    it('renders Client input with correct name attribute and label', () => {
      const html = renderSubmissionSearchForm(defaultFilteredValues)
      expect(html).toMatch(/<input[^>]*name="client"/i)
      expect(html).toMatch(/<label[^>]*>\s*Client\s*<\/label>/)
    })

    it('renders Clinician input with correct name attribute and label', () => {
      const html = renderSubmissionSearchForm(defaultFilteredValues)
      expect(html).toMatch(/<input[^>]*name="clinician"/i)
      expect(html).toMatch(/<label[^>]*>\s*Clinician\s*<\/label>/)
    })

    it('renders Status as a select element with label', () => {
      const html = renderSubmissionSearchForm(defaultFilteredValues)
      expect(html).toMatch(/<select[^>]*name="status"/i)
      expect(html).toMatch(/<label[^>]*>\s*Status\s*<\/label>/)
    })

    it('renders Submitted date as a select element with label', () => {
      const html = renderSubmissionSearchForm(defaultFilteredValues)
      expect(html).toMatch(/<select[^>]*name="submitted-date"/i)
      expect(html).toMatch(/<label[^>]*>\s*Submitted date\s*<\/label>/)
    })

    it('renders the component heading and all required labels', () => {
      const html = renderSubmissionSearchForm(defaultFilteredValues)
      expect(html).toMatch(/<h3[^>]*>\s*Filter submissions by\s*<\/h3>/)
      expect(html).toMatch(/<label[^>]*>\s*Client\s*<\/label>/)
      expect(html).toMatch(/<label[^>]*>\s*Clinician\s*<\/label>/)
      expect(html).toMatch(/<label[^>]*>\s*Status\s*<\/label>/)
      expect(html).toMatch(/<label[^>]*>\s*Submitted date\s*<\/label>/)
    })
  })

  describe('AC3: Search action', () => {
    it('renders a Search submit button', () => {
      const html = renderSubmissionSearchForm(defaultFilteredValues)
      expect(html).toMatch(/<button[^>]*type="submit"[^>]*>[\s\S]*?Search[\s\S]*?<\/button>/)
    })

    it('filter form submits to /results via GET', () => {
      const html = renderSubmissionSearchForm(defaultFilteredValues)
      expect(html).toMatch(/<form[^>]*method="get"[^>]*action="\/results"/)
    })
  })
})
