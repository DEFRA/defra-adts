/**
 * E2E tests for DASH-07 and DASH-08 — Start submissions for Sick and Healthy animals.
 *
 * Covers DASH-07 AC1, AC2 and AC3.
 * Covers DASH-08 AC1, AC2 and AC3.
 * 
 * @story DASH-07-08
 * @acs AC1, AC2, AC3
 * @journey Start submissions for Sick and Healthy animals
 */
import { test, expect } from '@playwright/test'
import { checkAccessibility } from '../utils/axe.js'

test.describe('DASH-07 — Start submission for Sick animal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('AC1, AC2: Display Sick Animal Submission Button and test it is selectable', async ({ page }) => {
    await page.getByRole('button', { name: 'Sick animal submission' }).isVisible()
    await page.getByRole('button', { name: 'Sick animal submission' }).isEnabled()
  })
   test('AC3: Start Sick Animal Submission Journey', async ({ page }) => {
    await page.getByRole('button', { name: 'Sick animal submission' }).click()
    await expect(page).toHaveURL(/\/submission-01-client-details/)
  })


})

test.describe('DASH-08 — Start submission for Healthy animal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('AC1, AC2: Display Healthy Animal Submission Button and test it is selectable', async ({ page }) => {
    await page.getByRole('button', { name: 'Healthy animal submission' }).isVisible()
    await page.getByRole('button', { name: 'Healthy animal submission' }).isEnabled()
  })
  
  test('AC3: Start Healthy Animal Submission Journey', async ({ page }) => {
    await page.getByRole('button', { name: 'Healthy animal submission' }).click()
    await expect(page).toHaveURL(/\/submission-01-client-details/)
  })


})
