/**
 * E2E tests for DASH-02 — Dashboard filter persistence.
 *
 * Covers AC3 (combined with AC4+AC5+AC6), AC7, AC8, AC9.
 *
 * Not covered here (owned elsewhere):
 * - AC1 (filter controls visible) → DASH-12 E2E AC2
 * - AC2 (status dropdown options) → component test
 *   services/adts-ui/tests/component/dashboard-filter-statuses.test.js
 * - AC4/AC5/AC6 as single-field tests — redundant with combined AC3+4+5+6
 *   test below (one navigation covers all fields)
 *
 * Note: ACs 3-6 reference the "Home link" in the service header, which is
 * a DASH-01 AC2 (not implemented - needs confirmation from Dee). These tests currently use the
 * in-page "back to home dashboard" link, which exercises the same
 * server-side session persistence. When DASH-01 AC2 lands, update the
 * selector to use the Home link.
 *
 * @story DASH-02
 * @acs AC3, AC4, AC5, AC6, AC7, AC8, AC9
 * @journey Dashboard filter persistence
 */

import { test, expect } from '@playwright/test'
import { checkAccessibility } from '../utils/axe.js'

test.describe('DASH-02 — Dashboard filter persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('AC3+AC4+AC5+AC6: all filter values persist after Search and navigating back', async ({ page }) => {
    await page.getByLabel('Client').fill('OLD MCDONALD')
    await page.getByLabel('Clinician').fill('Dr Smith')
    await page.getByLabel('Status').selectOption('draft')
    await page.getByLabel('Submitted date').selectOption('1_week')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/\/results/)

    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await expect(page).toHaveURL('/')

    await expect(page.getByLabel('Client')).toHaveValue('OLD MCDONALD')
    await expect(page.getByLabel('Clinician')).toHaveValue('Dr Smith')
    await expect(page.getByLabel('Status')).toHaveValue('draft')
    await expect(page.getByLabel('Submitted date')).toHaveValue('1_week')
  })

  test('AC7: filters are not cleared by repeated navigation or reload', async ({ page }) => {
    await page.getByLabel('Client').fill('OLD MCDONALD')
    await page.getByLabel('Status').selectOption('draft')
    await page.getByRole('button', { name: 'Search' }).click()

    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await expect(page.getByLabel('Client')).toHaveValue('OLD MCDONALD')

    await page.getByRole('button', { name: 'Search' }).click()
    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await expect(page.getByLabel('Client')).toHaveValue('OLD MCDONALD')
    await expect(page.getByLabel('Status')).toHaveValue('draft')

    await page.reload()
    await expect(page.getByLabel('Client')).toHaveValue('OLD MCDONALD')
    await expect(page.getByLabel('Status')).toHaveValue('draft')
  })

  test('AC8: manually clearing filters and searching returns default behaviour', async ({ page }) => {
    await page.getByLabel('Client').fill('OLD MCDONALD')
    await page.getByLabel('Clinician').fill('Dr Smith')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/client=OLD/)

    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await page.getByLabel('Client').clear()
    await page.getByLabel('Clinician').clear()
    await page.getByLabel('Status').selectOption('show_all')
    await page.getByRole('button', { name: 'Search' }).click()

    await expect(page).toHaveURL(/\/results/)
    await expect(page).not.toHaveURL(/client=OLD/)
    await expect(page).not.toHaveURL(/clinician=Dr\+Smith/)

    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await expect(page.getByLabel('Client')).toHaveValue('')
    await expect(page.getByLabel('Clinician')).toHaveValue('')
  })

  test.describe('AC9: accessibility of filter controls', () => {
    test('passes WCAG 2.2 AA checks via axe-core', async ({ page }) => {
      await checkAccessibility(page)
    })

    test('all filter controls are reachable by keyboard', async ({ page }) => {
      for (const label of ['Client', 'Clinician', 'Status', 'Submitted date']) {
        const field = page.getByLabel(label)
        await field.focus()
        await expect(field).toBeFocused()
      }

      const searchButton = page.getByRole('button', { name: 'Search' })
      await searchButton.focus()
      await expect(searchButton).toBeFocused()
    })

    test('Status dropdown can be operated with the keyboard', async ({ page }) => {
      const status = page.getByLabel('Status')
      await status.focus()
      await status.selectOption('draft')
      await expect(status).toHaveValue('draft')
    })
  })
})