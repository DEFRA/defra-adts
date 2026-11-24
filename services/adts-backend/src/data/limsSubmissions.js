import { dateCutoff, formatDate, matchesText } from './submissions.js'

const statusLabels = {
  draft: 'Draft',
  submitted: 'Submitted',
  in_progress: 'In progress',
  cancelled: 'Cancelled',
  samples_overdue: 'Samples overdue',
  tests_complete: 'All tests complete'
}

const statusKey = (item) => {
  if (typeof item === 'string') {
    const normalized = item.toLowerCase().replaceAll(/[\s-]+/g, '_')
    const aliases = { all_tests_complete: 'tests_complete' }
    return aliases[normalized] ?? normalized
  }

  const status = String(item.status ?? '').trim()
  const directStatus = { '': 'draft', Draft: 'draft', Cancelled: 'cancelled' }[status]
  if (directStatus) {
    return directStatus
  }

  const conditionalStatus = [
    [item.samplesOverdue === true, 'samples_overdue'],
    [item.resultsAvailable === true, 'tests_complete'],
    [item.isDigital === false, 'in_progress']
  ].find(([condition]) => condition)

  return conditionalStatus?.[1] ?? 'submitted'
}

const toResult = (item) => {
  const key = statusKey(item)
  const id = item.submissionId || item.draftSubmissionId
  const tests = (item.products ?? []).map(({ name, productType = '---', sampleType = '---' }) => ({
    name: name || '---',
    type: productType,
    sampleType,
    qty: item.numberSamples ?? '---'
  }))

  return {
    key,
    result: {
      id,
      statuses: [statusLabels[key] ?? item.status ?? '---'],
      samplesTo: item.samplesTo || '---',
      client: item.clientName || '---',
      clientFarm: item.clientFarm || '---',
      species: item.species || '---',
      clinician: item.clinician || '---',
      orderSubmitted: formatDate(item.submittedDate || item.changedStatusDate),
      hasTests: tests.length > 0,
      tests
    }
  }
}

const buildQuery = (pvsId, filters) => {
  const query = new URLSearchParams({ pvsId })
  if (filters.clientId) {
    query.set('clientId', filters.clientId)
  }
  const cutoff = dateCutoff(filters['submitted-date'])
  if (cutoff) {
    query.set('submittedDateBegin', cutoff.toISOString().slice(0, 10))
  }
  return query
}

const filterSubmissions = (records, filters) => {
  const wantedStatus = filters.status && filters.status !== 'show_all'
    ? statusKey(filters.status)
    : undefined

  return records
    .map(toResult)
    .filter(({ key, result }) =>
      (!wantedStatus || key === wantedStatus) &&
      matchesText(result.client, filters.client) &&
      matchesText(result.clinician, filters.clinician)
    )
    .map(({ result }) => result)
}

export const getLimsSubmissionReferences = async ({ clientId, clientName, clientFarm } = {}) => {
  const pvsId = process.env.LIMS_PVS_ID
  if (!pvsId) {
    throw new Error('LIMS_PVS_ID must be configured to retrieve submissions')
  }
  if (!clientId && !clientName && !clientFarm) {
    throw new Error('A client ID, name, or farm is required to retrieve submission references')
  }

  const response = await fetch(
    `${process.env.SUBMISSIONS_SERVICE_URL}/v1/submissions?${buildQuery(pvsId, { clientId })}`
  )
  if (!response.ok) {
    throw new Error(`Submissions service responded with status: ${response.status}`)
  }

  const records = await response.json()
  if (!Array.isArray(records)) {
    throw new TypeError('Submissions service returned an invalid response')
  }

  return [...new Set(records
    .filter(({ submissionId, clientName: recordClientName, clientFarm: recordClientFarm }) =>
      typeof submissionId === 'string' &&
      submissionId.trim() &&
      matchesText(recordClientName, clientName) &&
      matchesText(recordClientFarm, clientFarm)
    )
    .map(({ submissionId }) => submissionId.trim()))]
}

// LIMS filters by client ID and its status vocabulary is unconfirmed, so client name and status are matched here.
export const getLimsSubmissions = async (filters = {}) => {
  const pvsId = process.env.LIMS_PVS_ID
  if (!pvsId) {
    throw new Error('LIMS_PVS_ID must be configured to retrieve submissions')
  }

  const response = await fetch(
    `${process.env.SUBMISSIONS_SERVICE_URL}/v1/submissions?${buildQuery(pvsId, filters)}`
  )
  if (!response.ok) {
    throw new Error(`Submissions service responded with status: ${response.status}`)
  }

  const records = await response.json()
  if (!Array.isArray(records)) {
    throw new TypeError('Submissions service returned an invalid response')
  }

  return filterSubmissions(records, filters)
}
