import test from 'node:test'
import assert from 'node:assert/strict'

test('component test runner is configured', () => {
  assert.equal(true, true)
})
/**
 * Component tests for the dashboard home page.
 *
 * Verifies the filter block and submission management section
 * render correctly from the Nunjucks template, in isolation from
 * the Hapi server and session handling.
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

describe('Dashboard home page (DASH-12)', () => {
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
    filteredValues: {
      client: '',
      clinician: '',
      status: 'show all',
      submitted_date: ''
    }
  }

  describe('AC1: Submission management section heading', () => {
    it('renders the submission management section heading', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toContain('View completed submissions or edit draft submissions')
    })

    it('heading is rendered as h2 with the correct GOV.UK class', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(
        /<h2[^>]*class="[^"]*govuk-heading-l[^"]*"[^>]*>\s*View completed submissions or edit draft submissions\s*<\/h2>/
      )
    })
  })

  describe('AC2: Filter controls', () => {
    it('renders Client input with correct name attribute', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<input[^>]*name="client"/i)
      expect(html).toMatch(/<label[^>]*>\s*Client\s*<\/label>/)
    })

    it('renders Clinician input with correct name attribute', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<input[^>]*name="clinician"/i)
      expect(html).toMatch(/<label[^>]*>\s*Clinician\s*<\/label>/)
    })

    it('renders Status as a select element', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<select[^>]*name="status"/i)
      expect(html).toMatch(/<label[^>]*>\s*Status\s*<\/label>/)
    })

    it('renders Submitted date as a select element', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<select[^>]*name="submitted-date"/i)
      expect(html).toMatch(/<label[^>]*>\s*Submitted date\s*<\/label>/)
    })

    it('renders all required labels inside the Filter submissions by section', () => {
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

  describe('Filter value pre-population', () => {
    it('pre-populates Client field when filter value provided', () => {
      const html = env.render('home.njk', {
        filteredValues: {
          client: 'OLD MCDONALD',
          clinician: '',
          status: 'show all',
          submitted_date: ''
        }
      })
      expect(html).toMatch(/<input[^>]*name="client"[^>]*value="OLD MCDONALD"/i)
    })

    it('pre-populates Clinician field when filter value provided', () => {
      const html = env.render('home.njk', {
        filteredValues: {
          client: '',
          clinician: 'Dr Smith',
          status: 'show all',
          submitted_date: ''
        }
      })
      expect(html).toMatch(/<input[^>]*name="clinician"[^>]*value="Dr Smith"/i)
    })

    it('marks the selected Status option when filter value provided', () => {
      const html = env.render('home.njk', {
        filteredValues: {
          client: '',
          clinician: '',
          status: 'draft',
          submitted_date: ''
        }
      })
      expect(html).toMatch(/<option[^>]*value="draft"[^>]*selected/i)
    })

    it('defaults Status to "Show all" when no filter value provided', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<option[^>]*value="show all"[^>]*selected/i)
    })

    it('defaults Submitted date to "Last 18 months" when no filter value provided', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toMatch(/<option[^>]*value="18_months"[^>]*selected/i)
    })
  })

  describe('Security', () => {
    it('escapes HTML in Client filter value to prevent XSS', () => {
      const html = env.render('home.njk', {
        filteredValues: {
          client: '<script>alert("xss")</script>',
          clinician: '',
          status: 'show all',
          submitted_date: ''
        }
      })
      expect(html).not.toContain('<script>alert("xss")</script>')
      expect(html).toContain('&lt;script&gt;')
    })

    it('escapes HTML in Clinician filter value to prevent XSS', () => {
      const html = env.render('home.njk', {
        filteredValues: {
          client: '',
          clinician: '"><img src=x onerror=alert(1)>',
          status: 'show all',
          submitted_date: ''
        }
      })
      expect(html).not.toContain('<img src=x onerror')
    })
  })

  describe('Primary page landmarks', () => {
    it('renders the New submission section with Sick and Healthy submission buttons', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toContain('New submission')
      expect(html).toContain('Sick animal submission')
      expect(html).toContain('Healthy animal submission')
    })

    it('renders a GOV.UK header with service name', () => {
      const html = env.render('home.njk', defaultContext)
      expect(html).toContain('Animal Disease Testing Service')
    })
  })
})
