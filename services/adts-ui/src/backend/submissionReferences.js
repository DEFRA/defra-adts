export const getSubmissionReferences = async (clientDetails = {}) => {
  const query = new URLSearchParams()
  for (const [field, value] of Object.entries({
    clientId: clientDetails.clientId,
    clientName: clientDetails.name,
    clientFarm: clientDetails.farmName
  })) {
    if (typeof value === 'string' && value.trim()) {
      query.set(field, value.trim())
    }
  }

  if (query.size === 0) {
    return []
  }

  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetch(`${backendBaseUrl}/submission-references?${query}`)
  if (!response.ok) {
    throw new Error(`Submission reference lookup failed with status ${response.status}`)
  }

  const references = await response.json()
  if (!Array.isArray(references) || references.some((reference) => typeof reference !== 'string')) {
    throw new TypeError('Submission reference lookup returned an invalid response')
  }

  return references
}
