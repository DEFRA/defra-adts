import { fetchFromBackend } from './auth.js'

export const getCounties = async (request) => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetchFromBackend(`${backendBaseUrl}/GetCounties`, request)

  if (!response.ok) {
    throw new Error(`GetCounties failed with status ${response.status}`)
  }

  const counties = await response.json()

  return counties.map((item) => ({ countyCode: String(item.countyCode), name: item.name }))
}
