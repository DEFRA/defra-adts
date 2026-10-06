/**
 * Component tests for the Status dropdown on the dashboard.
 *
 * Verifies the Status filter options match the behaviour expected
 * by DASH-02 AC2 and the legacy ADTS service.
 *
 * @story DASH-02
 * @acs AC2
 */

import { describe, it, expect, beforeAll } from '@jest/globals'
import nunjucks from 'nunjucks'
import path from 'path'
import { fileURLToPath } from 'url'
import { getSelectItems } from '../../src/constants.js'

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

  const filteredValues = { client: '', clinician: '', status: 'show_all', submitted_date: '' }
  const { dateItems, statusItems } = getSelectItems(filteredValues)
  const defaultContext = { filteredValues, dateItems, statusItems }

  const requiredStatuses = [
    'Show All',
    'Draft',
    'Submitted',
    'In progress',
    'Cancelled',
    'Samples overdue',
    'All tests complete',
    'Results available'
  ]

  // Helper — isolate the Status select element so assertions don't false-positive
  // on text elsewhere on the page.
  const getStatusSelectHtml = (html) => {
    const match = html.match(/<select[^>]*name="status"[\s\S]*?<\/select>/)
    expect(match).not.toBeNull()
    return match[0]
  }

  requiredStatuses.forEach(status => {
    it(`includes the "${status}" option per legacy ADTS`, () => {
      const html = env.render('home.njk', defaultContext)
      const statusSelectHtml = getStatusSelectHtml(html)
      expect(statusSelectHtml).toMatch(new RegExp(`>${status}<\\/option>`))
    })
  })

  it('contains exactly 8 status options', () => {
    const html = env.render('home.njk', defaultContext)
    const statusSelectHtml = getStatusSelectHtml(html)
    const optionCount = (statusSelectHtml.match(/<option/g) || []).length
    expect(optionCount).toBe(8)
  })
})
