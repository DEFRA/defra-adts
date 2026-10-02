/**
 * E2E tests for DASH-12 — Submission Management Section on Dashboard.
 *
 * @story DASH-12
 * @acs AC1, AC2, AC3, AC4
 * @journey Dashboard
 */

import { test, expect } from '@playwright/test'
import { DashboardPage } from '../pages/dashboard.page.js'
import { checkAccessibility } from '../utils/axe.js'

test.describe('DASH-12 — Dashboard submission management', () => {
  /** @type {DashboardPage} */
  let dashboard

  test.beforeEach(async ({ page }) => {
    dashboard = new DashboardPage(page)
    await dashboard.goto()
  })

  test('AC1: section heading "View completed submissions or edit draft submissions" is displayed', async () => {
    await expect(dashboard.submissionManagementHeading).toBeVisible()
  })

  test('AC2: filter controls for Client, Clinician, Status, Submitted date are displayed', async () => {
    await expect(dashboard.clientFilter).toBeVisible()
    await expect(dashboard.clinicianFilter).toBeVisible()
    await expect(dashboard.statusFilter).toBeVisible()
    await expect(dashboard.submittedDateFilter).toBeVisible()
  })

  test('AC3: Search button submits the filter and updates the URL', async ({ page }) => {
    await dashboard.fillClientFilter('OLD MCDONALD')
    await dashboard.submitSearch()
    await expect(page).toHaveURL(/client=OLD\+MCDONALD/)
  })

    test('AC4: submission count is displayed above the list after search', async ({ page }) => {
    // The count appears on the /results page after submitting a search.
    // Empty-state behaviour is covered here; populated behaviour (singular/plural,
    // actual numbers) will be added once LIMS mock data is available.
    await dashboard.fillClientFilter('OLD MCDONALD')
    await dashboard.submitSearch()
    await expect(page.locator('text=/\\d+ submissions? matching criteria/i')).toBeVisible()
  })

  test('A11y: dashboard page has no critical or serious accessibility violations', async ({ page }) => {
    await checkAccessibility(page)
  })
})