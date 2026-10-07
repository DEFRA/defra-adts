/**
 * Component security tests for filter input rendering.
 *
 * Verifies the Nunjucks template escapes user-provided filter values to
 * prevent XSS when values are reflected back into the form. Hardening
 * tests — no story/AC, kept as regression against XSS.
 *
 * @story N/A (security hardening)
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import nunjucks from 'nunjucks'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Dashboard filter input XSS escaping', () => {
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

  it('escapes HTML in Client filter value to prevent XSS', () => {
    const html = env.render('home.njk', {
      filteredValues: {
        client: '<script>alert("xss")</script>',
        clinician: '',
        status: 'show_all',
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
        status: 'show_all',
        submitted_date: ''
      }
    })
    expect(html).not.toContain('<img src=x onerror')
  })
})
