import { beforeEach, describe, expect, jest, test } from '@jest/globals'
import home from '../../src/routes/home.js'

describe('Home route', () => {
  let route

  beforeEach(() => {
    home({
      route: (registeredRoute) => {
        route = registeredRoute
      }
    }, () => ({ name: 'Test User' }))
  })

  test('uses an empty submitted date when cached filters do not contain one', () => {
    const request = {
      yar: {
        get: jest.fn(() => ({
          client: 'Acme Farm',
          clinician: 'Dr Smith',
          status: 'draft'
        }))
      }
    }
    const h = { view: jest.fn() }

    route.handler(request, h)

    expect(h.view).toHaveBeenCalledWith('home.njk', {
      account: { name: 'Test User' },
      filteredValues: {
        client: 'Acme Farm',
        clinician: 'Dr Smith',
        status: 'draft',
        submitted_date: ''
      }
    })
  })
})
