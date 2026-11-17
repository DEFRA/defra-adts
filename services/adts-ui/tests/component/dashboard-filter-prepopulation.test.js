/**
 * Component tests for pre-population of filter field values on the dashboard.
 *
 * Verifies that when filter values are passed to the home template context
 * (e.g. restored from the Yar session), they are rendered back into the
 * form fields with the correct markup. Tests the template layer in
 * isolation from server-side session logic.
 *
 * @story DASH-02
 * @acs AC4, AC5, AC6
 */

import { describe, it, expect } from '@jest/globals'
import { renderSubmissionSearchForm } from './helpers/nunjucks.js'

describe('Dashboard filter pre-population (DASH-02 AC4-AC6)', () => {
  const defaultFilteredValues = {
    client: '',
    clinician: '',
    status: 'show_all',
    submitted_date: ''
  }

  it('AC5: pre-populates Client field when filter value provided', () => {
    const html = renderSubmissionSearchForm({
      client: 'OLD MCDONALD',
      clinician: '',
      status: 'show_all',
      submitted_date: ''
    })
    expect(html).toMatch(/<input[^>]*name="client"[^>]*value="OLD MCDONALD"/i)
  })

  it('AC5: pre-populates Clinician field when filter value provided', () => {
    const html = renderSubmissionSearchForm({
      client: '',
      clinician: 'Dr Smith',
      status: 'show_all',
      submitted_date: ''
    })
    expect(html).toMatch(/<input[^>]*name="clinician"[^>]*value="Dr Smith"/i)
  })

  it('AC4: marks the selected Status option when filter value provided', () => {
    const html = renderSubmissionSearchForm({
      client: '',
      clinician: '',
      status: 'draft',
      submitted_date: ''
    })
    expect(html).toMatch(/<option[^>]*value="draft"[^>]*selected/i)
  })

  it('AC4: defaults Status to "show_all" when no filter value provided', () => {
    const html = renderSubmissionSearchForm(defaultFilteredValues)
    expect(html).toMatch(/<option[^>]*value="show_all"[^>]*selected/i)
  })

  it('AC6: defaults Submitted date to "Last 18 months" when no filter value provided', () => {
    const html = renderSubmissionSearchForm(defaultFilteredValues)
    expect(html).toMatch(/<option[^>]*value="18_months"[^>]*selected/i)
  })
})
