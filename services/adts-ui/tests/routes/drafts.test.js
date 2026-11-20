import { afterAll, afterEach, beforeAll, describe, expect, jest, test } from '@jest/globals'
import createServer from '../../src/app.js'

const getCookieHeader = (response) => response.headers['set-cookie']?.[0]?.split(';')[0] || ''

describe('Continue draft route', () => {
  let server

  beforeAll(async () => {
    process.env.PORT = '3000'
    process.env.LOCAL_DRAFT_OWNER_ID = 'user-456'
    process.env.BACKEND_SERVICE_URL = 'http://localhost:3200'
    process.env.SESSION_SECRET = 'test-session-secret-with-at-least-32-characters'
    server = await createServer()
  })

  afterAll(async () => {
    await server.stop()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  test('restores saved answers and opens the last saved page', async () => {
    const formData = {
      clientDetails: { name: 'Acme Farm', farmName: 'North Field' },
      animalDetails: { speciesId: '7', species: 'Sheep' },
      clinicalHistory: { contactedAboutSameCase: 'no' }
    }
    jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).endsWith('/drafts/draft-001')) {
        return new Response(JSON.stringify({
          draftId: 'draft-001',
          status: 'Draft',
          revision: 3,
          lastSavedPage: 'submission-02-species',
          formData
        }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }

      return new Response(JSON.stringify([{ speciesId: '7', name: 'Sheep' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    })

    const continueResponse = await server.inject({
      method: 'GET',
      url: '/drafts/draft-001/continue'
    })

    expect(continueResponse.statusCode).toBe(302)
    expect(continueResponse.headers.location).toBe('/submission-02-species')
    expect(globalThis.fetch.mock.calls[0][1].headers)
      .toEqual({ 'x-local-draft-owner-id': 'user-456' })

    const resumedPage = await server.inject({
      method: 'GET',
      url: '/submission-02-species',
      headers: { cookie: getCookieHeader(continueResponse) }
    })

    expect(resumedPage.statusCode).toBe(200)
    expect(resumedPage.payload).toContain('value="Sheep" selected')
    expect(resumedPage.request.response.source.context.submissionFormState).toEqual({
      draftId: 'draft-001',
      revision: 3,
      lastSavedPage: 'submission-02-species',
      formData
    })
  })

  test('does not send a draft with an unknown saved page to the beginning of the journey', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      draftId: 'draft-001',
      status: 'Draft',
      revision: 1,
      lastSavedPage: 'unknown-page',
      formData: {}
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const response = await server.inject({
      method: 'GET',
      url: '/drafts/draft-001/continue'
    })

    expect(response.statusCode).toBe(422)
    expect(response.payload).toContain('saved progress is unavailable')
  })

  test('does not fall back to an earlier step when required saved context is missing', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      draftId: 'draft-001',
      status: 'Draft',
      revision: 1,
      lastSavedPage: 'submission-02-animal-details',
      formData: { animalDetails: {} }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }))

    const response = await server.inject({
      method: 'GET',
      url: '/drafts/draft-001/continue'
    })

    expect(response.statusCode).toBe(422)
    expect(response.payload).toContain('saved progress is unavailable')
  })

  test('shows an explicit error when the backend cannot load a draft', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(
      JSON.stringify({ error: 'Draft not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } }
    ))

    const response = await server.inject({
      method: 'GET',
      url: '/drafts/missing-draft/continue'
    })

    expect(response.statusCode).toBe(404)
    expect(response.payload).toContain('We could not load this draft')
  })
})
