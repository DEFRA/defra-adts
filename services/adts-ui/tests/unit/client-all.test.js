import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals'

const initAll = jest.fn()
const enhanceSelectElement = jest.fn()

jest.unstable_mockModule('govuk-frontend', () => ({ initAll }))
jest.unstable_mockModule('accessible-autocomplete', () => ({
  default: { enhanceSelectElement }
}))

const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')

describe('client initialization', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  afterAll(() => {
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor)
    } else {
      delete globalThis.document
    }
  })

  test('enhances client and animal address lookups with selection-specific edit controls', async () => {
    const clientOption = { textContent: 'Acme Farm', selected: false }
    const animalAddressOption = { textContent: 'Green Acres', selected: false }
    const clientSelect = {
      dataset: { defaultValue: 'Acme Farm' },
      options: [clientOption]
    }
    const animalAddressSelect = {
      dataset: { defaultValue: 'Green Acres' },
      options: [animalAddressOption]
    }
    Object.defineProperty(clientSelect, 'value', {
      get: () => clientOption.selected ? '101' : ''
    })
    Object.defineProperty(animalAddressSelect, 'value', {
      get: () => animalAddressOption.selected ? '102' : ''
    })
    const speciesSelect = { dataset: { defaultValue: 'Sheep' } }
    const editButton = { hidden: true }
    const animalAddressEditButton = { hidden: true }
    globalThis.document = {
      querySelector: jest.fn((selector) => {
        if (selector === 'select#client') return clientSelect
        if (selector === 'select#animalAddress') return animalAddressSelect
        if (selector === 'select#species') return speciesSelect
        if (selector === '[data-client-edit-button]') return editButton
        if (selector === '[data-animal-address-edit-button]') return animalAddressEditButton
        return null
      }),
      querySelectorAll: jest.fn().mockReturnValue([])
    }
    clientSelect.addEventListener = jest.fn()
    animalAddressSelect.addEventListener = jest.fn()

    await import('../../src/client/all.js')

    expect(initAll).toHaveBeenCalledTimes(1)
    expect(globalThis.document.querySelector).toHaveBeenCalledWith('select#client')
    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: 'Acme Farm',
      selectElement: clientSelect,
      onConfirm: expect.any(Function)
    })
    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: 'Green Acres',
      selectElement: animalAddressSelect,
      onConfirm: expect.any(Function)
    })
    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: 'Sheep',
      selectElement: speciesSelect
    })
    expect(editButton.hidden).toBe(true)
    expect(animalAddressEditButton.hidden).toBe(true)
    expect(clientSelect.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(animalAddressSelect.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))

    const clientLookupConfig = enhanceSelectElement.mock.calls.find(([config]) =>
      config.selectElement === clientSelect
    )[0]
    clientLookupConfig.onConfirm('Acme Farm')
    expect(clientOption.selected).toBe(true)
    expect(editButton.hidden).toBe(false)

    const animalAddressLookupConfig = enhanceSelectElement.mock.calls.find(([config]) =>
      config.selectElement === animalAddressSelect
    )[0]
    animalAddressLookupConfig.onConfirm('Green Acres')
    expect(animalAddressOption.selected).toBe(true)
    expect(animalAddressEditButton.hidden).toBe(false)

    clientOption.selected = false
    clientSelect.addEventListener.mock.calls[0][1]()
    expect(editButton.hidden).toBe(true)
  })

  test('does not enhance a client select when it is not present', async () => {
    globalThis.document = {
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn().mockReturnValue([])
    }

    await import('../../src/client/all.js')

    expect(initAll).toHaveBeenCalledTimes(1)
    expect(globalThis.document.querySelector).toHaveBeenCalledWith('select#client')
    expect(enhanceSelectElement).not.toHaveBeenCalled()
  })

  test('preserves the client selection before opening the new client address page', async () => {
    const form = {
      appendChild: jest.fn(),
      submit: jest.fn()
    }
    const createClientAddressLink = {
      addEventListener: jest.fn(),
      closest: jest.fn().mockReturnValue(form)
    }
    const createdInput = {}
    globalThis.document = {
      querySelector: jest.fn((selector) => selector === '[data-create-client-address-link]'
        ? createClientAddressLink
        : null),
      querySelectorAll: jest.fn().mockReturnValue([]),
      createElement: jest.fn().mockReturnValue(createdInput)
    }

    await import('../../src/client/all.js')

    const clickHandler = createClientAddressLink.addEventListener.mock.calls[0][1]
    const event = { preventDefault: jest.fn() }
    clickHandler(event)

    expect(event.preventDefault).toHaveBeenCalled()
    expect(form.action).toBe('/submission-01-client-address/start')
    expect(createdInput).toMatchObject({
      type: 'hidden',
      name: 'intent',
      value: 'newClientAddress'
    })
    expect(form.appendChild).toHaveBeenCalledWith(createdInput)
    expect(form.submit).toHaveBeenCalled()
  })

  test('enhances each county select using its own default value', async () => {
    const countySelect = { dataset: { defaultValue: 'Dorset' } }
    const animalAddressCountySelect = { dataset: { defaultValue: 'Argyll and Bute' } }
    globalThis.document = {
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn((selector) => selector === 'select#county, select#animalAddressCounty'
        ? [countySelect, animalAddressCountySelect]
        : [])
    }

    await import('../../src/client/all.js')

    expect(globalThis.document.querySelectorAll).toHaveBeenCalledWith('select#county, select#animalAddressCounty')
    expect(enhanceSelectElement).toHaveBeenCalledTimes(2)
    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: 'Dorset',
      inputClasses: 'govuk-!-width-one-half',
      selectElement: countySelect
    })
    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: 'Argyll and Bute',
      inputClasses: 'govuk-!-width-one-half',
      selectElement: animalAddressCountySelect
    })
  })

  test('enhances the breed select without a default value', async () => {
    const breedSelect = { dataset: {} }
    globalThis.document = {
      querySelector: jest.fn((selector) => selector === 'select#breed' ? breedSelect : null),
      querySelectorAll: jest.fn().mockReturnValue([])
    }

    await import('../../src/client/all.js')

    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: '',
      selectElement: breedSelect
    })
  })

  test('shows only the animal ID inputs matching the selected number of animals', async () => {
    const numberOfAnimals = {
      value: '1',
      addEventListener: jest.fn()
    }
    const animalIdInputs = Array.from({ length: 10 }, (_, index) => ({
      dataset: { animalIndex: String(index + 1) },
      hidden: false
    }))
    globalThis.document = {
      querySelector: jest.fn((selector) => selector === '#numberOfAnimals' ? numberOfAnimals : null),
      querySelectorAll: jest.fn((selector) => selector === '.app-animal-id' ? animalIdInputs : [])
    }

    await import('../../src/client/all.js')

    expect(animalIdInputs[0].hidden).toBe(false)
    expect(animalIdInputs.slice(1).every((input) => input.hidden)).toBe(true)

    numberOfAnimals.value = '3'
    numberOfAnimals.addEventListener.mock.calls[0][1]()

    expect(animalIdInputs.slice(0, 3).every((input) => !input.hidden)).toBe(true)
    expect(animalIdInputs.slice(3).every((input) => input.hidden)).toBe(true)
  })
})
