export const jsonResponse = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...headers
    }
  })

export const createMockLimsFetch = (responses = []) => {
  const requests = []
  const queuedResponses = [...responses]

  const fetch = async (input, init = {}) => {
    requests.push({ url: String(input), init })
    const next = queuedResponses.shift()

    if (next instanceof Error) {
      throw next
    }

    if (next instanceof Response) {
      return next
    }

    if (next === undefined) {
      throw new Error('No mocked LIMS response was queued')
    }

    return jsonResponse(next.body, next.status ?? 200, next.headers)
  }

  return {
    fetch,
    requests,
    get attemptCount () {
      return requests.length
    },
    enqueue (response) {
      queuedResponses.push(response)
    }
  }
}
