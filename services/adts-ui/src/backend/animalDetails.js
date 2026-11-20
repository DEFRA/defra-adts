import { fetchFromBackend } from './auth.js'

export const getAnimalDetails = async (speciesId, request) => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetchFromBackend(
    `${backendBaseUrl}/GetAnimalDetails?speciesId=${encodeURIComponent(speciesId)}`,
    request
  )

  if (!response.ok) {
    throw new Error(`GetAnimalDetails failed with status ${response.status}`)
  }

  return response.json()
}
