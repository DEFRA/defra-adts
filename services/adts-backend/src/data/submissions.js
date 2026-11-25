import { ScanCommand } from '@aws-sdk/lib-dynamodb'
import { submissionsTable } from './dynamo.js'

const DAYS_IN_WEEK = 7
const DAYS_IN_FORTNIGHT = 14
const MONTHS_IN_HALF_YEAR = 6
const MONTHS_IN_EIGHTEEN_MONTHS = 18

const subtractUtcMonths = (date, months) => {
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() - months)

  const lastDayOfMonth = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    0
  )).getUTCDate()

  date.setUTCDate(Math.min(day, lastDayOfMonth))
}

export const dateCutoff = (period, now = new Date()) => {
  if (!period) {
    return undefined
  }

  const cutoff = new Date(now)
  const periods = {
    '1_day': () => cutoff.setUTCDate(cutoff.getUTCDate() - 1),
    '1_week': () => cutoff.setUTCDate(cutoff.getUTCDate() - DAYS_IN_WEEK),
    '14_days': () => cutoff.setUTCDate(cutoff.getUTCDate() - DAYS_IN_FORTNIGHT),
    '1_month': () => subtractUtcMonths(cutoff, 1),
    '6_months': () => subtractUtcMonths(cutoff, MONTHS_IN_HALF_YEAR),
    '1_year': () => cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1),
    '18_months': () => subtractUtcMonths(cutoff, MONTHS_IN_EIGHTEEN_MONTHS)
  }

  if (!Object.hasOwn(periods, period)) {
    throw new Error(`Unsupported submitted-date filter: ${period}`)
  }

  periods[period]()
  return cutoff
}

export const matchesText = (value, filter) =>
  !filter || String(value ?? '').toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())

export const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '---'
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${day}/${months[date.getUTCMonth()]}/${date.getUTCFullYear()}`
}

// Drafts saved by the submission flow keep their details inside formData.
const normaliseItem = (item) => {
  const draftId = item.draftId ?? item.submissionId
  if (!draftId || !item.formData) {
    return item
  }

  const { clientDetails, animalDetails } = item.formData || {}
  return {
    ...item,
    submissionId: draftId,
    client: clientDetails?.name ?? item.client,
    clientFarm: clientDetails?.farmName ?? item.clientFarm,
    species: animalDetails?.species ?? item.species,
    submittedAt: item.updatedAt ?? item.submittedAt
  }
}

const toSearchResult = (item) => ({
  id: item.submissionId,
  statuses: ['Draft'],
  samplesTo: item.samplesTo || '---',
  client: item.client || '---',
  clientFarm: item.clientFarm || '---',
  species: item.species || '---',
  clinician: item.clinician || '---',
  orderSubmitted: formatDate(item.submittedAt),
  hasTests: Boolean(item.tests?.length),
  tests: item.tests || []
})

const getSubmissionItems = async (docClient, ownerId, exclusiveStartKey) => {
  const result = await docClient.send(new ScanCommand({
    TableName: submissionsTable(),
    FilterExpression: '(#status = :draft OR #status = :draftLower) AND (#ownerId = :ownerId OR #userId = :ownerId)',
    ExpressionAttributeNames: {
      '#status': 'status',
      '#ownerId': 'ownerId',
      '#userId': 'userId'
    },
    ExpressionAttributeValues: { ':draft': 'Draft', ':draftLower': 'draft', ':ownerId': ownerId },
    ExclusiveStartKey: exclusiveStartKey
  }))

  const items = result.Items ?? []
  if (!result.LastEvaluatedKey) {
    return items.filter((item) => (item.ownerId ?? item.userId) === ownerId)
  }

  return [
    ...items.filter((item) => (item.ownerId ?? item.userId) === ownerId),
    ...await getSubmissionItems(docClient, ownerId, result.LastEvaluatedKey)
  ]
}

export const getSubmissions = async (docClient, ownerId, filters = {}) => {
  if (!ownerId) {
    throw new Error('Draft owner is required')
  }

  const items = (await getSubmissionItems(docClient, ownerId)).map(normaliseItem)
  const cutoff = dateCutoff(filters['submitted-date'])
  const results = items
    .filter((item) =>
      matchesText(item.client, filters.client) &&
      matchesText(item.clinician, filters.clinician) &&
      (!cutoff || new Date(item.submittedAt) >= cutoff)
    )
    .sort((left, right) => String(right.submittedAt).localeCompare(String(left.submittedAt)))
    .map(toSearchResult)

  return { results, totalCount: results.length }
}
