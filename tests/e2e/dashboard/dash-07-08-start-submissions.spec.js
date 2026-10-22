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
import { DashboardPage } from '../pages/dashboard.page.js'

test.describe('DASH-07 DASH-08 — Start submission for Sick and Healthy animals', () => {

  /** @type {DashboardPage} */
  let dashboard

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page)
    await dashboard.goto()
  })

  test('AC1, AC2: Display Sick Animal Submission Button and test it is selectable', async ({ page }) => {
    await expect(dashboard.sickSubmission).toBeVisible()
    await expect(dashboard.sickSubmission).toBeEnabled()
  })
  test('AC3: Start Sick Animal Submission Journey', async ({ page }) => {
    //await expect(dashboard.sickSubmission).click
    await dashboard.sickSubmission.click()
    await expect(page).toHaveURL(/\/submission-01-client-details/)
  })

  test('AC1, AC2: Display Healthy Animal Submission Button and test it is selectable', async ({ page }) => {
    await expect(dashboard.healthySubmission).toBeVisible()
    await expect(dashboard.healthySubmission).toBeEnabled()
  })

  test('AC3: Start Healthy Animal Submission Journey', async ({ page }) => {
    await dashboard.healthySubmission.click()
    await expect(page).toHaveURL(/\/submission-01-client-details/)
  })

  test('Accessibility: all filter controls are reachable by keyboard', async ({ page }) => {
    // Accessibility for the whole page covered in dash-02-filter-persistence.spec.js test
    //keyboard accessibility for sick submission button
    const sickSubmissionButton = dashboard.sickSubmission
    await sickSubmissionButton.focus()
    await expect(sickSubmissionButton).toBeFocused()

    //keyboard accessibility for healthy submission button
    const healthySubmissionButton = dashboard.healthySubmission
    await healthySubmissionButton.focus()
    await expect(healthySubmissionButton).toBeFocused()
  })

})




