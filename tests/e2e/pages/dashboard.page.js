/**
 * Page object for the ADTS dashboard page.
 *
 * @story DASH-12
 */

export class DashboardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page

    // AC1 — section heading
    this.submissionManagementHeading = page.getByRole('heading', {
      name: 'View completed submissions or edit draft submissions'
    })

    // AC2 — filter controls
    this.clientFilter = page.getByLabel('Client')
    this.clinicianFilter = page.getByLabel('Clinician')
    this.statusFilter = page.getByLabel('Status')
    this.submittedDateFilter = page.getByLabel('Submitted date')

    // AC3 — search action
    this.searchButton = page.getByRole('button', { name: 'Search' })

    // AC4 — count display (locator will depend on actual markup; adjust after inspecting)
    this.submissionCount = page.locator('[data-testid="submission-count"], h2:has-text("submissions matching criteria")')
  }

  async goto() {
    await this.page.goto('/')
  }

  async fillClientFilter(value) {
    await this.clientFilter.fill(value)
  }

  async submitSearch() {
    await this.searchButton.click()
  }
}