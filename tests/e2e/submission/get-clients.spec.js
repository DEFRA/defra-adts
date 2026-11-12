import { expect, test } from '@playwright/test'

const limsUrl = 'http://localhost:3300'

test.describe('Client lookup via LIMS', () => {
  test('renders LIMS clients as options and queries LIMS server-side', async ({ page }) => {
    const response = await page.goto('/submission-01-client-details')
    const html = await response.text()

    await expect(page.getByRole('combobox', { name: 'Client' })).toBeVisible()
    expect(html).toContain(
      '<option value="client-001">Example Farm, North Field, 1 Test Lane, Teston, Dorset, ZZ1 1ZZ, 12/345/6789</option>'
    )
    expect(html).toContain('<option value="42">Second Example Farm</option>')

    const limsRequests = await (await page.request.get(`${limsUrl}/__requests`)).json()
    expect(limsRequests).toContainEqual({ pvsId: 'E2E-PVS-001', filter: '' })
  })

  test('does not expose the LIMS identifier to the browser', async ({ page }) => {
    const browserUrls = []
    page.on('request', (request) => browserUrls.push(request.url()))

    await page.goto('/submission-01-client-details')
    const html = await page.content()

    expect(html).not.toContain('E2E-PVS-001')
    expect(browserUrls.filter((url) => url.includes('E2E-PVS-001') || url.includes('getClients'))).toEqual([])
  })

  test('does not render selected client or animal address summaries', async ({ page }) => {
    await page.goto('/submission-01-client-details')
    await page.getByRole('combobox', { name: 'Client' }).fill('Example Farm')
    await page.getByRole('option', {
      name: 'Example Farm, North Field, 1 Test Lane, Teston, Dorset, ZZ1 1ZZ, 12/345/6789',
      exact: true
    }).click()
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await page.getByRole('combobox', { name: 'Animal address' }).fill('Second Example Farm')
    await page.getByRole('option', { name: 'Second Example Farm', exact: true }).click()
    await page.getByRole('button', { name: 'Continue' }).click()
    await expect(page).toHaveURL(/\/submission-02-species$/)

    await page.goto('/submission-01-client-details')

    await expect(page.getByText('Selected client', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Selected animal address', { exact: true })).toHaveCount(0)
    await expect(page.locator('.govuk-inset-text')).toHaveCount(0)
    await expect(page.locator('[data-client-edit-button]')).toBeVisible()
    await expect(page.locator('[data-animal-address-edit-button]')).toBeVisible()
  })

  test('keeps the edit button visible for a manually entered animal address', async ({ page }) => {
    await page.goto('/submission-01-client-details')
    await page.getByRole('combobox', { name: 'Client' }).fill('Example Farm')
    await page.getByRole('option', {
      name: 'Example Farm, North Field, 1 Test Lane, Teston, Dorset, ZZ1 1ZZ, 12/345/6789',
      exact: true
    }).click()
    await page.getByRole('radio', { name: 'No', exact: true }).check()
    await page.getByRole('link', { name: "create a new animal's address" }).click()
    await expect(page).toHaveURL(/\/submission-01-animal-address/)

    await page.getByLabel('Name').fill('Manual animal address')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page).toHaveURL(/\/submission-01-client-details$/)
    await expect(page.locator('[data-animal-address-edit-button]')).toBeVisible()
    await page.locator('[data-animal-address-edit-button]').click()
    await expect(page).toHaveURL(/\/submission-01-animal-address\?intent=edit$/)
    await expect(page.getByRole('heading', { name: 'Edit animal address' })).toBeVisible()
  })
})
