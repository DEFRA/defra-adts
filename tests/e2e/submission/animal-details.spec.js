import { expect, test } from '@playwright/test'

test.describe('Animal details reference data', () => {
  test('loads species-specific fields from the reference table and saves selected answers', async ({ page }) => {
    await page.goto('/submission-02-species')
    await page.getByLabel('Species').fill('Cattle')
    await page.getByRole('option', { name: 'Cattle', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page).toHaveURL('/submission-02-animal-details')
    await expect(page.getByLabel('Breed (optional)')).toBeVisible()
    await expect(page.locator('#breed-select option[value="HOLSTEIN"]')).toHaveText('Holstein')
    await expect(page.getByRole('radio', { name: 'Adult' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Calf' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Dairy' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Housed' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Outdoor' })).toBeVisible()
    await expect(page.getByRole('radio', { name: 'Aviary' })).toHaveCount(0)
    await expect(page.getByRole('radio', { name: 'Female' })).toBeVisible()
    await expect(page.getByRole('group', {
      name: 'Is the farm accredited organic? (optional)'
    })).toBeVisible()

    await page.getByLabel('Breed (optional)').fill('Holstein')
    await page.getByRole('option', { name: 'Holstein', exact: true }).click()
    await page.getByRole('radio', { name: 'Adult' }).check()
    await page.getByRole('radio', { name: 'Dairy' }).check()
    await page.getByRole('radio', { name: 'Housed' }).check()
    await page.getByRole('radio', { name: 'Female' }).check()
    await page.getByRole('radio', { name: 'Yes', exact: true }).check()
    await page.getByLabel('Number of animals').selectOption('2')
    await page.getByLabel('Animal 1:').fill('SYNTHETIC-EAR-TAG-1')
    await page.getByRole('button', { name: 'Continue' }).click()

    await expect(page).toHaveURL('/submission-03-clinical-history')
    await page.getByRole('link', { name: 'Back', exact: true }).click()

    await expect(page).toHaveURL('/submission-02-animal-details')
    await expect(page.getByLabel('Breed (optional)')).toHaveValue('Holstein')
    await expect(page.locator('#breed-select')).toHaveValue('HOLSTEIN')
    await expect(page.getByRole('radio', { name: 'Adult' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Dairy' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Housed' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Female' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Yes', exact: true })).toBeChecked()
    await expect(page.getByLabel('Number of animals')).toHaveValue('2')
    await expect(page.getByLabel('Animal 1:')).toHaveValue('SYNTHETIC-EAR-TAG-1')
  })
})
