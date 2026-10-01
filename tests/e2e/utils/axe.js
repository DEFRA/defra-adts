/**
 * Accessibility test helper wrapping @axe-core/playwright.
 * Runs axe against the WCAG 2.2 AA ruleset per the test strategy.
 */

import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'

/**
 * Run axe accessibility checks against the current page.
 * Fails the test if critical or serious violations are found.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function checkAccessibility(page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
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