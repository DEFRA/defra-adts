/**
 * Component tests for the Status dropdown on the dashboard.
 *
 * Verifies the Status filter options match the behaviour expected
 * by DASH-02 AC2.
 *
 * @story DASH-02
 * @acs AC2
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import nunjucks from 'nunjucks'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

describe('Dashboard filter — Status dropdown (DASH-02 AC2)', () => {
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

  const requiredStatuses = [
    'Show all',
    'Draft',
    'Submitted',
    'In progress',
    'Cancelled',
    'Samples overdue',
    'All tests complete',
  ]

  // Helper — isolate the Status select element so assertions don't false-positive
  // on text elsewhere on the page.
  const getStatusSelectHtml = (html) => {
    const match = html.match(/<select[^>]*name="status"[\s\S]*?<\/select>/)
    expect(match).not.toBeNull()
    return match[0]
  }

  const pageContexts = [
    ['home.njk', defaultContext],
    ['results.njk', { ...defaultContext, results: [], totalCount: 0 }]
  ]

  pageContexts.forEach(([page, context]) => {
    requiredStatuses.forEach(status => {
      it(`includes the "${status}" option on ${page}`, () => {
        const html = env.render(page, context)
        const statusSelectHtml = getStatusSelectHtml(html)
        expect(statusSelectHtml).toMatch(new RegExp(`>${status}<\\/option>`))
      })
    })
  })

  it('uses the same "Show all" label on both pages', () => {
    const labels = pageContexts.map(([page, context]) => {
      const html = env.render(page, context)
      return getStatusSelectHtml(html).match(/<option[^>]*value="show_all"[^>]*>(.*?)<\/option>/)[1]
    })

    expect(labels).toEqual(['Show all', 'Show all'])
  })

  it('contains exactly 7 status options', () => {
    const html = env.render('home.njk', defaultContext)
    const statusSelectHtml = getStatusSelectHtml(html)
    const optionCount = (statusSelectHtml.match(/<option/g) || []).length
    expect(optionCount).toBe(7)
  })
})
