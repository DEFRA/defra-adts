/**
 * Component security tests for filter input rendering.
 *
 * Verifies the Nunjucks template escapes user-provided filter values to
 * prevent XSS when values are reflected back into the form. Hardening
 * tests — no story/AC, kept as regression against XSS.
 *
 * @story N/A (security hardening)
 */

import { describe, it, expect } from '@jest/globals'
import { renderSubmissionSearchForm } from './helpers/nunjucks.js'

describe('Dashboard filter input XSS escaping', () => {
  it('escapes HTML in Client filter value to prevent XSS', () => {
    const html = renderSubmissionSearchForm({
      client: '<script>alert("xss")</script>',
      clinician: '',
      status: 'show_all',
      submitted_date: ''
    })
    expect(html).not.toContain('<script>alert("xss")</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('escapes HTML in Clinician filter value to prevent XSS', () => {
    const html = renderSubmissionSearchForm({
      client: '',
      clinician: '"><img src=x onerror=alert(1)>',
      status: 'show_all',
      submitted_date: ''
    })
    expect(html).not.toContain('<img src=x onerror')
  })
})
