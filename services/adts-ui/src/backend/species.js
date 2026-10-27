export const getSpecies = async () => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetch(`${backendBaseUrl}/GetSpecies`)

  if (!response.ok) {
    throw new Error(`GetSpecies failed with status ${response.status}`)
  }

  const species = await response.json()

  return species.map((item) => ({ speciesId: String(item.speciesId), name: item.name }))
}
