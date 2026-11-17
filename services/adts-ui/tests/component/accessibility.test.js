/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import jestAxe from 'jest-axe'
import { renderSubmissionSearchForm } from './helpers/nunjucks.js'

const { axe, toHaveNoViolations } = jestAxe

expect.extend(toHaveNoViolations)

describe('Component accessibility', () => {
  it('renders the submission search form without axe violations', async () => {
    const formHtml = renderSubmissionSearchForm({
      client: '',
      clinician: '',
      status: 'show_all',
      submitted_date: ''
    })
    const html = `<main><h1>Submission search</h1><h2>Filters</h2>${formHtml}</main>`

    expect(await axe(html)).toHaveNoViolations()
  })
})
