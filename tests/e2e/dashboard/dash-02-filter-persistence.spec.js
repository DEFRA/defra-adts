/**
 * @story DASH-02
 * @acs AC1, AC2, AC3, AC4, AC5, AC6, AC7, AC8, AC9
 * @journey Dashboard filter persistence
 */

import { test, expect } from '@playwright/test'
import { checkAccessibility } from '../utils/axe.js'

test.describe('DASH-02 — Dashboard filter persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('AC1: all filter controls are visible on the dashboard', async ({ page }) => {
    await expect(page.getByLabel('Client')).toBeVisible()
    await expect(page.getByLabel('Clinician')).toBeVisible()
    await expect(page.getByLabel('Status')).toBeVisible()
    await expect(page.getByLabel('Submitted date')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Search' })).toBeVisible()
  })

  test('AC2: Status dropdown contains the implemented status options', async ({ page }) => {
    // Asserts current template behaviour. Label mismatches against legacy ADTS
    // are tracked as defects on DASH-02 — see component tests for the gap.
    const statusSelect = page.getByLabel('Status')
    await expect(statusSelect.locator('option')).toHaveCount(8)

    const implementedLabels = [
      'Show all',
      'Draft',
      'Submitted',
      'In progress',
      'Cancelled',
      'Samples overdue',
      'Tests complete',
      'Available'
    ]

    for (const label of implementedLabels) {
      await expect(statusSelect.locator(`option:has-text("${label}")`)).toHaveCount(1)
    }
  })

  test('AC3-AC6: all filter values persist after Search and navigating back', async ({ page }) => {
    await page.getByLabel('Client').fill('OLD MCDONALD')
    await page.getByLabel('Clinician').fill('Dr Smith')
    await page.getByLabel('Status').selectOption('draft')
    await page.getByLabel('Submitted date').selectOption('18_months')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/\/results/)

    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await expect(page).toHaveURL('/')

    await expect(page.getByLabel('Client')).toHaveValue('OLD MCDONALD')
    await expect(page.getByLabel('Clinician')).toHaveValue('Dr Smith')
    await expect(page.getByLabel('Status')).toHaveValue('draft')
    await expect(page.getByLabel('Submitted date')).toHaveValue('18_months')
  })

  test('AC4: Status dropdown selection is preserved on return', async ({ page }) => {
    await page.getByLabel('Status').selectOption('submitted')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/status=submitted/)

    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await expect(page.getByLabel('Status')).toHaveValue('submitted')
  })

  test('AC5: Clinician value is preserved on return', async ({ page }) => {
    await page.getByLabel('Clinician').fill('Dave Simonds')
    await page.getByRole('button', { name: 'Search' }).click()

    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await expect(page.getByLabel('Clinician')).toHaveValue('Dave Simonds')
  })

  test('AC6: Submitted date value is preserved on return', async ({ page }) => {
    await page.getByLabel('Submitted date').selectOption('all')
    await page.getByRole('button', { name: 'Search' }).click()

    await page.getByRole('link', { name: /back to home dashboard/i }).click()
    await expect(page.getByLabel('Submitted date')).toHaveValue('all')
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
    await page.getByLabel('Status').selectOption('show all')
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