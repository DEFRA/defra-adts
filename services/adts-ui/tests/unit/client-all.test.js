import { afterAll, beforeEach, describe, expect, jest, test } from '@jest/globals'

const initAll = jest.fn()
const enhanceSelectElement = jest.fn()
const observe = jest.fn()
const mutationObserver = jest.fn(() => ({ observe }))

jest.unstable_mockModule('govuk-frontend', () => ({ initAll }))
jest.unstable_mockModule('accessible-autocomplete', () => ({
  default: { enhanceSelectElement }
}))

const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')

describe('client initialization', () => {
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    globalThis.window = { MutationObserver: mutationObserver }
  })

  afterAll(() => {
    if (documentDescriptor) {
      Object.defineProperty(globalThis, 'document', documentDescriptor)
    } else {
      delete globalThis.document
    }

    if (windowDescriptor) {
      Object.defineProperty(globalThis, 'window', windowDescriptor)
    } else {
      delete globalThis.window
    }
  })

  test('enhances client and species selects using their default values', async () => {
    const clientSelect = { dataset: { defaultValue: 'Acme Farm' } }
    const speciesSelect = { dataset: { defaultValue: 'Sheep' } }
    const editButton = { hidden: false }
    const hint = { setAttribute: jest.fn() }
    globalThis.document = {
      body: {},
      querySelector: jest.fn((selector) => {
        if (selector === 'select#client') return clientSelect
        if (selector === 'select#species') return speciesSelect
        if (selector === '[data-client-edit-button]') return editButton
        return null
      }),
      querySelectorAll: jest.fn((selector) => selector === '.autocomplete__hint' ? [hint] : [])
    }
    clientSelect.addEventListener = jest.fn()

    await import('../../src/client/all.js')

    expect(initAll).toHaveBeenCalledTimes(1)
    expect(globalThis.document.querySelector).toHaveBeenCalledWith('select#client')
    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: 'Acme Farm',
      selectElement: clientSelect
    })
    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: 'Sheep',
      selectElement: speciesSelect
    })
    expect(editButton.hidden).toBe(true)
    expect(clientSelect.addEventListener).toHaveBeenCalledWith('change', expect.any(Function))
    expect(hint.setAttribute).toHaveBeenCalledWith('aria-hidden', 'true')
    expect(mutationObserver).toHaveBeenCalledWith(expect.any(Function))
    expect(observe).toHaveBeenCalledWith(globalThis.document.body, { childList: true, subtree: true })

    clientSelect.value = '101'
    clientSelect.addEventListener.mock.calls[0][1]()
    expect(editButton.hidden).toBe(false)
  })

  test('does not enhance a client select when it is not present', async () => {
    globalThis.document = {
      body: {},
      querySelector: jest.fn().mockReturnValue(null),
      querySelectorAll: jest.fn().mockReturnValue([])
    }

    await import('../../src/client/all.js')

    expect(initAll).toHaveBeenCalledTimes(1)
    expect(globalThis.document.querySelector).toHaveBeenCalledWith('select#client')
    expect(enhanceSelectElement).not.toHaveBeenCalled()
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
      body: {},
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
