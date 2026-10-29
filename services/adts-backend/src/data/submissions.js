import { ScanCommand } from '@aws-sdk/lib-dynamodb'

const DAYS_IN_WEEK = 7
const DAYS_IN_FORTNIGHT = 14
const MONTHS_IN_HALF_YEAR = 6
const MONTHS_IN_EIGHTEEN_MONTHS = 18

const tableName = () => process.env.SUBMISSIONS_TABLE || 'adts-submissions'

const dateCutoff = (period, now = new Date()) => {
  if (!period) {
    return undefined
  }

  const cutoff = new Date(now)
  const periods = {
    '1_day': () => cutoff.setUTCDate(cutoff.getUTCDate() - 1),
    '1_week': () => cutoff.setUTCDate(cutoff.getUTCDate() - DAYS_IN_WEEK),
    '14_days': () => cutoff.setUTCDate(cutoff.getUTCDate() - DAYS_IN_FORTNIGHT),
    '1_month': () => cutoff.setUTCMonth(cutoff.getUTCMonth() - 1),
    '6_months': () => cutoff.setUTCMonth(cutoff.getUTCMonth() - MONTHS_IN_HALF_YEAR),
    '1_year': () => cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1),
    '18_months': () => cutoff.setUTCMonth(cutoff.getUTCMonth() - MONTHS_IN_EIGHTEEN_MONTHS)
  }

  if (!Object.hasOwn(periods, period)) {
    throw new Error(`Unsupported submitted-date filter: ${period}`)
  }

  periods[period]()
  return cutoff
}

const matchesText = (value, filter) =>
  !filter || String(value ?? '').toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase())

const formatDate = (value) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '---'
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${day}/${months[date.getUTCMonth()]}/${date.getUTCFullYear()}`
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

const getSubmissionItems = async (docClient, exclusiveStartKey) => {
  const result = await docClient.send(new ScanCommand({
    TableName: tableName(),
    FilterExpression: '#status = :draft',
    ExpressionAttributeNames: { '#status': 'status' },
    ExpressionAttributeValues: { ':draft': 'Draft' },
    ExclusiveStartKey: exclusiveStartKey
  }))

  const items = result.Items ?? []
  if (!result.LastEvaluatedKey) {
    return items
  }

  return [...items, ...await getSubmissionItems(docClient, result.LastEvaluatedKey)]
}

export const getSubmissions = async (docClient, filters = {}) => {
  const items = await getSubmissionItems(docClient)
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
