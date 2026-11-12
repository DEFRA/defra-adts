import { expect, test } from '@playwright/test'
import { checkAccessibility } from './utils/axe.js'

test.describe('Page-level accessibility', () => {
  test('Dashboard page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'New submission' })).toBeVisible()

    await checkAccessibility(page)
  })

  test('Client details page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-01-client-details')
    await expect(page.getByRole('heading', { name: '1. Client details' })).toBeVisible()

    await checkAccessibility(page)
  })

  test('Species page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-02-species')
    await expect(page.getByLabel('Species')).toBeVisible()

    await checkAccessibility(page)
  })

  test('Animal details page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-02-species')
    await page.getByLabel('Species').fill('Cattle')
    await page.getByRole('option', { name: 'Cattle', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/submission-02-animal-details$/)
    await expect(page.getByLabel('Number of animals')).toBeVisible()

    await checkAccessibility(page)
  })

  test('Clinical history page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-03-clinical-history')
    await expect(page.getByRole('heading', { name: '3. Clinical history' })).toBeVisible()

    await checkAccessibility(page)
  })

  test('Results page has no critical or serious axe violations', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Search' }).click()
    await expect(page).toHaveURL(/\/results/)
    await expect(page.getByRole('heading', { name: 'Submission search results' })).toBeVisible()

    await checkAccessibility(page)
  })
})

test.describe('Interactive accessibility states', () => {
  test('Client autocomplete suggestions have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-01-client-details')
    await page.getByLabel('Client').fill('Example Farm')
    await expect(page.getByRole('option', { name: /^Example Farm/ })).toBeVisible()
    await expect(page.locator('.autocomplete__hint')).toHaveAttribute('aria-hidden', 'true')

    await checkAccessibility(page)
  })

  test('Species autocomplete suggestions have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-02-species')
    await page.getByLabel('Species').fill('Cow')
    await expect(page.getByRole('option', { name: 'Cow', exact: true })).toBeVisible()
    await expect(page.locator('.autocomplete__hint')).toHaveAttribute('aria-hidden', 'true')

    await checkAccessibility(page)
  })

  test('Breed autocomplete suggestions have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-02-species')
    await page.getByLabel('Species').fill('Cattle')
    await page.getByRole('option', { name: 'Cattle', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/submission-02-animal-details$/)

    await page.getByLabel('Breed (optional)').fill('Holstein')
    await expect(page.getByRole('option', { name: 'Holstein', exact: true })).toBeVisible()
    await expect(page.locator('.autocomplete__hint')).toHaveAttribute('aria-hidden', 'true')

    await checkAccessibility(page)
  })

  test('Revealed animal address fields have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-01-client-details')
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await expect(page.locator('#animalAddress')).toBeVisible()

    await checkAccessibility(page)
  })

  test('Animal ID fields for the selected animal count have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-02-species')
    await page.getByLabel('Species').fill('Cattle')
    await page.getByRole('option', { name: 'Cattle', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/submission-02-animal-details$/)

    await page.getByLabel('Number of animals').selectOption('3')
    await expect(page.getByLabel('Animal 3:')).toBeVisible()
    await expect(page.getByLabel('Animal 4:')).toBeHidden()

    await checkAccessibility(page)
  })

  test('Client details validation errors have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-01-client-details')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'There is a problem' })).toBeVisible()

    await checkAccessibility(page)
  })

  test('Species validation errors have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-02-species')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'There is a problem' })).toBeVisible()

    await checkAccessibility(page)
  })

  test('Animal details validation errors have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-02-species')
    await page.getByLabel('Species').fill('Cattle')
    await page.getByRole('option', { name: 'Cattle', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/submission-02-animal-details$/)

    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'There is a problem' })).toBeVisible()

    await checkAccessibility(page)
  })

  test('Clinical history validation errors have no critical or serious axe violations', async ({ page }) => {
    await page.goto('/submission-03-clinical-history')
    await page.locator('#sampleTakenDate-day').fill('31')
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page.getByRole('heading', { name: 'There is a problem' })).toBeVisible()

    await checkAccessibility(page)
  })
})
