import { expect, test } from '@playwright/test'

const limsUrl = 'http://localhost:3300'

test.describe('Client lookup via LIMS', () => {
  test('renders LIMS clients as options and queries LIMS server-side', async ({ page }) => {
    await page.goto('/submission-01-client-details')

    await expect(page.locator('option[value="client-001"]')).toHaveText('Example Farm')
    await expect(page.locator('option[value="42"]')).toHaveText('Second Example Farm')

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
})
