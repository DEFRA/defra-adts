import { fetchFromBackend } from './auth.js'

export const getSpecies = async (request) => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetchFromBackend(`${backendBaseUrl}/GetSpecies`, request)

  if (!response.ok) {
    throw new Error(`GetSpecies failed with status ${response.status}`)
  }

  const species = await response.json()

  return species.map((item) => ({ speciesId: String(item.speciesId), name: item.name }))
}
