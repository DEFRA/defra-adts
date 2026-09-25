/**
 * Placeholder page object for the ADTS dashboard.
 */

class DashboardPage {
  constructor(page) {
    this.page = page
  }

  async goto() {
    await this.page.goto('/dashboard')
  }
}

module.exports = { DashboardPage }
