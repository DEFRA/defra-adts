import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'

/**
 * Run axe-core WCAG 2.2 AA checks against the current page.
 * Fails the test if critical or serious violations are found.
 *
 * Narrow exceptions cover known GOV.UK Frontend findings without suppressing
 * other rules or findings on the affected components.
 *
 * @param {import('@playwright/test').Page} page
 */
export async function checkAccessibility (page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze()

  const isKnownConditionalRadioViolation = (node) =>
    node.target.includes('#animalsAtClientAddress-2') &&
    node.html.includes('name="animalsAtClientAddress"') &&
    node.all.length === 1 &&
    node.all[0].id === 'aria-allowed-attr' &&
    node.all[0].data?.length === 1 &&
    /^aria-expanded="(?:true|false)"$/.test(node.all[0].data[0])

  const isGovUkHeaderTarget = async (node) => {
    const selector = node.target.at(-1)
    if (!selector) {
      return false
    }

    return page.locator(selector).evaluateAll((elements) =>
      elements.length > 0 && elements.every((element) => element.closest('.govuk-header') !== null)
    )
  }

  const violations = await Promise.all(results.violations.map(async (violation) => {
    if (violation.id === 'aria-allowed-attr') {
      return {
        ...violation,
        nodes: violation.nodes.filter((node) => !isKnownConditionalRadioViolation(node))
      }
    }

    if (violation.id === 'target-size') {
      const nodes = []
      for (const node of violation.nodes) {
        if (!await isGovUkHeaderTarget(node)) {
          nodes.push(node)
        }
      }

      return { ...violation, nodes }
    }

    return violation
  }))

  const criticalOrSerious = violations.filter(
    (violation) =>
      (violation.impact === 'critical' || violation.impact === 'serious') &&
      violation.nodes.length > 0
  )

  expect(
    criticalOrSerious,
    `Found ${criticalOrSerious.length} critical/serious accessibility violations:\n` +
      criticalOrSerious
        .map((violation) => `  - ${violation.id}: ${violation.description}`)
        .join('\n')
  ).toHaveLength(0)
}
