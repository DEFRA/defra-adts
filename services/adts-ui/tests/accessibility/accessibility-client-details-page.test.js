/**
 * @jest-environment jsdom
 */

import { describe, expect, it } from '@jest/globals'
import jestAxe from 'jest-axe'
import nunjucks from 'nunjucks'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const { axe, toHaveNoViolations } = jestAxe
expect.extend(toHaveNoViolations)

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const templateEnvironment = nunjucks.configure(
  [
    path.resolve(testDirectory, '../../src/views'),
    path.resolve(testDirectory, '../../node_modules/govuk-frontend/dist')
  ],
  { autoescape: true, throwOnUndefined: false }
)

const defaultContext = {
  clientDetails: {},
  clientOptions: [
    { value: '', text: 'Select a client', selected: true },
    { value: '101', text: 'Acme Farm', selected: false }
  ],
  animalAddressOptions: [
    { value: '', text: 'Select an animal address', selected: true },
    { value: '102', text: 'Green Acres', selected: false }
  ],
  countyOptions: [],
  animalAddressCountyOptions: [],
  errors: {},
  errorList: [],
  selectedClientName: '',
  selectedAnimalAddressName: '',
  hasSelectedClient: false,
  hasSelectedAnimalAddress: false,
  hasManualClient: false,
  hasSavedManualAnimalAddress: false,
  animalsAtClientAddress: '',
  animalAddress: '',
  editMode: false,
  saveError: '',
  selectionError: '',
  submissionFormState: {}
}

const renderPage = (overrides = {}) => {
  const html = templateEnvironment.render('select-client.njk', {
    ...defaultContext,
    ...overrides
  })
  const page = document.implementation.createHTMLDocument()

  page.open()
  page.write(html)
  page.close()

  return page
}

const getVisibleFocusableElements = (container) =>
  [...container.querySelectorAll(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]'
  )].filter((element) =>
    element.tabIndex >= 0 &&
    !element.closest('[hidden]') &&
    !element.closest('[aria-hidden="true"]') &&
    !element.closest('footer')
  )

describe('Client details page accessibility', () => {
  it('provides a skip link, clear landmarks, and a current submission step', () => {
    const page = renderPage()

    expect(page.querySelector('a.govuk-skip-link')?.getAttribute('href')).toBe('#main-content')
    expect(page.querySelector('#main-content')?.tagName).toBe('MAIN')
    expect(page.querySelector('main h1')?.textContent).toContain('1. Client details')
    expect(page.querySelector('nav[aria-label="Submission progress"]')).not.toBeNull()
    expect(page.querySelector('[aria-current="step"]')?.textContent).toContain('Client details')
  })

  it('keeps visible controls in a logical keyboard focus order without positive tabindex values', () => {
    const page = renderPage()
    const focusableElements = getVisibleFocusableElements(page.body)
    const skipLink = page.querySelector('a.govuk-skip-link')
    const indexOf = (element) => focusableElements.indexOf(element)
    const clientSelect = page.querySelector('#client')
    const createClientLink = page.querySelector('[data-create-client-address-link]')
    const yesRadio = page.querySelector('input[name="animalsAtClientAddress"][value="yes"]')
    const continueButton = [...page.querySelectorAll('button[type="submit"]')]
      .find((element) => element.textContent.trim() === 'Continue')

    expect(focusableElements[0]).toBe(skipLink)
    expect(indexOf(clientSelect)).toBeLessThan(indexOf(createClientLink))
    expect(indexOf(createClientLink)).toBeLessThan(indexOf(yesRadio))
    expect(indexOf(yesRadio)).toBeLessThan(indexOf(continueButton))
    expect([...page.querySelectorAll('main [tabindex]')].filter((element) => element.tabIndex > 0))
      .toHaveLength(0)
  })

  it('provides accessible names and native grouped controls for the client and animal location', () => {
    const page = renderPage()

    expect(page.querySelector('label[for="client"]')?.textContent).toContain('Client')
    expect(page.querySelector('select#client')).not.toBeNull()
    expect(page.querySelector('a[data-create-client-address-link]')?.textContent).toContain('create a new client')
    expect(page.querySelector('fieldset legend')?.textContent).toContain('Are the animals at the client’s address?')
    expect(page.querySelectorAll('input[type="radio"][name="animalsAtClientAddress"]')).toHaveLength(2)
    expect(page.querySelector('label[for="animalAddress"]')?.textContent).toContain('Animal address')
    expect([...page.querySelectorAll('button[type="submit"]')].some(
      (element) => element.textContent.trim() === 'Continue'
    )).toBe(true)
  })

  it('keeps animal-address actions out of the focus order until No is selected', () => {
    const initialPage = renderPage()
    const noPage = renderPage({ animalsAtClientAddress: 'no' })

    expect(initialPage.querySelector('#animal-address-selection').hasAttribute('hidden')).toBe(true)
    expect(getVisibleFocusableElements(initialPage.querySelector('main')).some(
      (element) => element.id === 'animalAddress'
    )).toBe(false)

    expect(noPage.querySelector('#animal-address-selection').hasAttribute('hidden')).toBe(false)
    expect(getVisibleFocusableElements(noPage.querySelector('main')).some(
      (element) => element.id === 'animalAddress'
    )).toBe(true)
    expect(noPage.querySelector('input[name="animalsAtClientAddress"][value="no"]').checked).toBe(true)
  })

  it('associates validation errors with the summary and relevant field', () => {
    const errorText = 'Enter or select an animal address'
    const page = renderPage({
      animalsAtClientAddress: 'no',
      errors: { animalAddress: errorText },
      errorList: [{ text: errorText, href: '#animalAddress' }]
    })
    const errorSummary = page.querySelector('.govuk-error-summary')
    const animalAddress = page.querySelector('#animalAddress')

    expect(page.title).toMatch(/^Error:/)
    expect(errorSummary?.querySelector('[role="alert"] h2')?.textContent).toContain('There is a problem')
    expect(errorSummary?.querySelector('a[href="#animalAddress"]')?.textContent).toContain(errorText)
    expect(page.querySelector('#animalAddress-error')?.textContent).toContain(errorText)
    expect(animalAddress?.getAttribute('aria-describedby')).toContain('animalAddress-error')
  })

  it('has no axe violations in the main content for initial, conditional, and error states', async () => {
    const states = [
      renderPage(),
      renderPage({ animalsAtClientAddress: 'no' }),
      renderPage({
        animalsAtClientAddress: 'no',
        errors: { animalAddress: 'Enter or select an animal address' },
        errorList: [{ text: 'Enter or select an animal address', href: '#animalAddress' }]
      })
    ]

    for (const page of states) {
      expect(await axe(page.querySelector('main'))).toHaveNoViolations()
    }
  })

  it('exposes an important save error in a named notification region', () => {
    const page = renderPage({ saveError: 'The draft could not be saved.' })
    const notification = page.querySelector('.govuk-notification-banner')
    const headingId = notification?.getAttribute('aria-labelledby')

    expect(notification?.getAttribute('role')).toBe('region')
    expect(page.getElementById(headingId)?.textContent.trim()).toBe('Important')
    expect(notification?.textContent).toContain('The draft could not be saved.')
  })
})
