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

  test('enhances client and species selects using their default values', async () => {
    const clientSelect = { dataset: { defaultValue: 'Acme Farm' } }
    const speciesSelect = { dataset: { defaultValue: 'Sheep' } }
    const editButton = { hidden: false }
    globalThis.document = {
      querySelector: jest.fn((selector) => {
        if (selector === '#client') return clientSelect
        if (selector === '#species') return speciesSelect
        if (selector === '[data-client-edit-button]') return editButton
        return null
      })
    }
    clientSelect.addEventListener = jest.fn()

    await import('../../src/client/all.js')

    expect(initAll).toHaveBeenCalledTimes(1)
    expect(globalThis.document.querySelector).toHaveBeenCalledWith('#client')
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

    clientSelect.value = '101'
    clientSelect.addEventListener.mock.calls[0][1]()
    expect(editButton.hidden).toBe(false)
  })

  test('does not enhance a client select when it is not present', async () => {
    globalThis.document = {
      querySelector: jest.fn().mockReturnValue(null)
    }

    await import('../../src/client/all.js')

    expect(initAll).toHaveBeenCalledTimes(1)
    expect(globalThis.document.querySelector).toHaveBeenCalledWith('#client')
    expect(enhanceSelectElement).not.toHaveBeenCalled()
  })
})
