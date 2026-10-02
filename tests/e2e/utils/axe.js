import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'

/**
 * Run axe-core WCAG 2.2 AA checks against the current page.
 * Fails the test if critical or serious violations are found.
 *
 * Known exclusions:
 * - `.govuk-header` — WCAG 2.5.8 target-size violations on header links are
 *   present in GOV.UK Frontend 5.14.0. Not ADTS code; raised with the
 *   GOV.UK Design System team. Reviewed in independent accessibility audit
 *   before go-live.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function checkAccessibility(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .exclude('.govuk-header')
    .analyze()

  const criticalOrSerious = results.violations.filter(
    (v) => v.impact === 'critical' || v.impact === 'serious'
  )

  expect(
    criticalOrSerious,
    `Found ${criticalOrSerious.length} critical/serious accessibility violations:\n` +
      criticalOrSerious.map((v) => `  - ${v.id}: ${v.description}`).join('\n')
  ).toHaveLength(0)
}