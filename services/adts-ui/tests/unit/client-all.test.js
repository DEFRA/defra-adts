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

  test('enhances the client select using its default value', async () => {
    const clientSelect = { dataset: { defaultValue: 'Acme Farm' } }
    globalThis.document = {
      querySelector: jest.fn((selector) => selector === '#client' ? clientSelect : null)
    }

    await import('../../src/client/all.js')

    expect(initAll).toHaveBeenCalledTimes(1)
    expect(globalThis.document.querySelector).toHaveBeenCalledWith('#client')
    expect(enhanceSelectElement).toHaveBeenCalledWith({
      defaultValue: 'Acme Farm',
      selectElement: clientSelect
    })
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
