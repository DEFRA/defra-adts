import { createServer } from 'node:http'
import { timingSafeEqual } from 'node:crypto'

const port = Number(process.env.PORT ?? 8500)
const host = process.env.HOST ?? '127.0.0.1'
const configuredPrefix = (process.env.LIMS_MOCK_PREFIX ?? '/LIMSRestAPi/').replace(/^\/+|\/+$/g, '')
const username = process.env.LIMS_MOCK_USERNAME ?? process.env.LIMS_USERNAME ?? 'e2e-user'
const password = process.env.LIMS_MOCK_PASSWORD ?? process.env.LIMS_PASSWORD ?? 'e2e-password'
const expectedAuthorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
const failureEndpoint = process.env.LIMS_MOCK_FAILURE_ENDPOINT
const failureMode = process.env.LIMS_MOCK_FAILURE_MODE
const failureDelayMs = Number(process.env.LIMS_MOCK_DELAY_MS ?? 0)

let nextDraftId = 100
let nextSubmissionId = 1
const drafts = new Map()
const submissions = new Map()

const products = [
  {
    productId: 'PC0203',
    name: 'Synthetic mastitis test',
    price: 12.5,
    species: ['CATTLE'],
    productType: 'TEST',
    type: 'TEST',
    accredited: true,
    isFOP: false,
    isSOP: false,
    sampleTypes: [{ sampleId: 'SERUM', sampleName: 'Serum', testSampleName: 'Serum', isPooled: false, maxPool: 0, isPairable: false }],
    options: []
  }
]

const clients = [
  {
    clientId: 'C-456',
    name: 'Synthetic Client',
    farm: 'Sample Farm',
    address: 'Main Road, Sampleton',
    subCounty: '',
    county: 'Test County',
    postcode: 'AA1 1AA',
    cphh: '00-000-0000'
  }
]

const pvs = {
  pvsId: 'PVS001',
  pvsName: 'E2E Veterinary Practice',
  pvsAddress1: '1 Test Street',
  pvsAddress2: 'Testville',
  pvsAddress3: 'Test County',
  pvsAddress4: '',
  pvsPostcode: 'AA1 1AA'
}

const releasedResults = {
  Sections: [],
  SampleComments: [],
  VioComment: '',
  WorkInProgress: [],
  Charges: [],
  samples: []
}

const pdfBase64 = Buffer.from('%PDF-1.4\n% Synthetic LIMS mock report\n%%EOF').toString('base64')

const sendJson = (response, statusCode, payload) => {
  response.writeHead(statusCode, { 'content-type': 'application/json' })
  response.end(JSON.stringify(payload))
}

const readJson = async (request) => {
  const chunks = []
  let length = 0
  for await (const chunk of request) {
    length += chunk.length
    if (length > 2 * 1024 * 1024) {
      throw new Error('Request body exceeds mock limit')
    }
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

const isAuthorized = (authorization) => {
  if (typeof authorization !== 'string' || authorization.length !== expectedAuthorization.length) {
    return false
  }
  return timingSafeEqual(Buffer.from(authorization), Buffer.from(expectedAuthorization))
}

const resetState = () => {
  nextDraftId = 100
  nextSubmissionId = 1
  drafts.clear()
  submissions.clear()
}

const findFailure = async (endpoint, response) => {
  if (!failureEndpoint || failureEndpoint !== endpoint || !failureMode) {
    return false
  }

  if (failureMode === 'delay') {
    await new Promise((resolve) => setTimeout(resolve, failureDelayMs || 3000))
    return false
  }
  if (failureMode === 'http-500') {
    sendJson(response, 500, { message: 'Synthetic LIMS failure' })
    return true
  }
  if (failureMode === 'http-503') {
    sendJson(response, 503, { message: 'Synthetic LIMS unavailable' })
    return true
  }
  if (failureMode === 'business-error') {
    sendJson(response, 200, {
      hasErrors: true,
      errorMessages: ['Synthetic LIMS business rejection']
    })
    return true
  }
  if (failureMode === 'invalid-json') {
    response.writeHead(200, { 'content-type': 'application/json' })
    response.end('{invalid-json')
    return true
  }
  return false
}

const handleGet = (endpoint, url, response) => {
  switch (endpoint) {
    case 'general/getpingOK':
      return sendJson(response, 200, true)
    case 'general/getProducts': {
      const filter = url.searchParams.get('filter')?.toLowerCase() ?? ''
      const species = url.searchParams.get('species')
      const matches = products.filter((product) =>
        (!filter || product.name.toLowerCase().includes(filter) || product.productId.toLowerCase() === filter) &&
        (!species || product.species.includes(species))
      )
      return sendJson(response, 200, matches)
    }
    case 'general/getClients': {
      if (url.searchParams.get('pvsId') !== pvs.pvsId) {
        return sendJson(response, 200, [])
      }
      const filter = url.searchParams.get('filter')?.toLowerCase() ?? ''
      return sendJson(response, 200, clients.filter((client) => !filter || client.name.toLowerCase().includes(filter)))
    }
    case 'general/getPVS':
      return sendJson(response, 200, { ...pvs, pvsId: url.searchParams.get('pvsId') ?? pvs.pvsId })
    case 'submissions/getSubmissionIdList': {
      const pvsid = url.searchParams.get('pvsid')
      if (!pvsid) return sendJson(response, 200, [])
      const filter = url.searchParams.get('filter') ?? ''
      const ids = [...submissions.keys(), ...drafts.keys()]
        .filter((id) => !filter || id.includes(filter))
        .map((submissionId) => ({ submissionId }))
      return sendJson(response, 200, ids)
    }
    case 'submissions/getSubmissions': {
      const pvsid = url.searchParams.get('pvsid')
      if (!pvsid) return sendJson(response, 200, [])
      const filter = url.searchParams.get('filter') ?? ''
      const records = [...submissions.values(), ...drafts.values()]
        .filter((item) => !filter || item.submissionId?.includes(filter) || item.draftSubmissionId?.includes(filter))
        .map((item) => ({
          draftSubmissionId: item.draftSubmissionId,
          submissionId: item.submissionId ?? '',
          status: item.status ?? 'Draft',
          type: item.submissionType,
          species: item.animalSpeciesId,
          clientName: item.clientName,
          clientFarm: item.clientFarm,
          clinician: item.clinician,
          submittedDate: item.submittedDate ?? null,
          isCancelable: item.status === 'Draft',
          products: (item.products ?? []).map(({ productId, name = '' }) => ({ productId, name }))
        }))
      return sendJson(response, 200, records)
    }
    case 'submissions/getSubmission': {
      const draft = drafts.get(url.searchParams.get('submissionId'))
      return draft ? sendJson(response, 200, draft) : sendJson(response, 404, { message: 'Draft not found' })
    }
    case 'submissions/viewSubmission': {
      const submission = submissions.get(url.searchParams.get('submissionId'))
      return submission ? sendJson(response, 200, submission) : sendJson(response, 404, { message: 'Submission not found' })
    }
    case 'submissions/getDeliveryAddresses':
      return sendJson(response, 200, {
        singleAddress: {
          address: { address1: 'Test Laboratory', address2: 'Test Road', address3: 'Test County, AA1 1AA', labEmail: 'lab@example.test', labId: 'LAB1', rmLicence: '' },
          tests: []
        },
        separateAddresses: []
      })
    case 'submissions/getLatestReleasedResults':
      return sendJson(response, 200, releasedResults)
    case 'submissions/getReleaseSummaryAndReport':
      return sendJson(response, 200, { LastReportString: pdfBase64 })
    case 'submissions':
      return sendJson(response, 200, { results: [], totalCount: 0 })
    default:
      return sendJson(response, 404, { message: 'Unknown mock LIMS endpoint' })
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${host}:${port}`)
  if (url.pathname === '/health') {
    return sendJson(response, 200, { status: 'UP' })
  }

  if (url.pathname === '/__admin/reset' && request.method === 'POST') {
    resetState()
    return sendJson(response, 200, { status: 'RESET' })
  }

  if (!isAuthorized(request.headers.authorization)) {
    return sendJson(response, 401, { message: 'Unauthorized' })
  }

  const prefixPath = `/${configuredPrefix}/`
  if (!url.pathname.startsWith(prefixPath)) {
    return sendJson(response, 404, { message: 'Unknown mock LIMS path' })
  }
  const endpoint = url.pathname.slice(prefixPath.length)

  if (await findFailure(endpoint, response)) {
    return
  }

  if (request.method === 'GET') {
    return handleGet(endpoint, url, response)
  }

  if (request.method === 'POST' && endpoint === 'submissions/createUpdateDraftSubmission') {
    let payload
    try {
      payload = await readJson(request)
    } catch {
      return sendJson(response, 400, { message: 'Invalid JSON draft payload' })
    }

    const draftSubmissionId = payload.draftSubmissionId || String(++nextDraftId)
    drafts.set(draftSubmissionId, { ...payload, draftSubmissionId, status: 'Draft' })
    return sendJson(response, 200, { draftSubmissionId })
  }

  if (request.method === 'POST' && endpoint === 'submissions/confirmDraftSubmission') {
    let payload
    try {
      payload = await readJson(request)
    } catch {
      return sendJson(response, 400, { message: 'Invalid confirmation payload' })
    }

    const draft = drafts.get(payload.draftSubmissionId)
    if (!draft) {
      return sendJson(response, 200, { submissionId: '' })
    }

    const submissionId = `VI-26-${String(nextSubmissionId++).padStart(6, '0')}`
    const submission = { ...draft, submissionId, status: 'Submitted', submittedDate: new Date().toISOString() }
    submissions.set(submissionId, submission)
    drafts.set(payload.draftSubmissionId, submission)
    return sendJson(response, 200, { submissionId })
  }

  if (request.method === 'POST' && endpoint === 'submissions/cancelSubmission') {
    let payload
    try {
      payload = await readJson(request)
    } catch {
      return sendJson(response, 400, { message: 'Invalid cancellation payload' })
    }

    const id = payload.submissionDraftId
    if (drafts.has(id)) {
      const draft = drafts.get(id)
      drafts.set(id, { ...draft, status: 'Cancelled' })
    } else if (submissions.has(id)) {
      const submission = submissions.get(id)
      submissions.set(id, { ...submission, status: 'Cancelled' })
    }
    return sendJson(response, 200, { hasErrors: false, errorMessages: [] })
  }

  return sendJson(response, 404, { message: 'Unknown mock LIMS endpoint' })
})

server.listen(port, host, () => {
  console.log(`Mock LIMS listening on http://${host}:${port} with prefix /${configuredPrefix}/`)
})
