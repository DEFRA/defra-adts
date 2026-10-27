export const getAnimalDetails = async (speciesId) => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetch(`${backendBaseUrl}/GetAnimalDetails?speciesId=${encodeURIComponent(speciesId)}`)

  if (!response.ok) {
    throw new Error(`GetAnimalDetails failed with status ${response.status}`)
  }

  return response.json()
}
