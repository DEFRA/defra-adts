import { describe, expect, test } from '@jest/globals'
import { mapLimsClient } from '../../src/data/limsClients.js'

describe('mapLimsClient', () => {
  const countyNames = new Map([['DEV', 'Devon']])

  test('splits the comma-separated address into address lines and keeps only the first three', () => {
    const client = mapLimsClient({
      clientId: 'client-001',
      name: 'Example Farm',
      farm: '  North Field ',
      address: '1 Test Lane, Teston, Upper Road, Extra Line',
      county: 'DEV',
      postcode: 'ZZ1 1ZZ',
      cphh: '12/345/6789'
    }, countyNames)

    expect(client).toEqual({
      clientId: 'client-001',
      name: 'Example Farm',
      farmName: 'North Field',
      addressLine1: '1 Test Lane',
      addressLine2: 'Teston',
      addressLine3: 'Upper Road',
      county: 'Devon',
      postcode: 'ZZ1 1ZZ',
      cph: '12/345/6789'
    })
  })

  test('fills missing LIMS fields with empty strings', () => {
    const client = mapLimsClient({ clientId: 42, name: 'Second Example Farm' }, countyNames)

    expect(client).toEqual({
      clientId: 42,
      name: 'Second Example Farm',
      farmName: '',
      addressLine1: '',
      addressLine2: '',
      addressLine3: '',
      county: '',
      postcode: '',
      cph: ''
    })
  })
})
