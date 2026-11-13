export const getCounties = async () => {
  const backendBaseUrl = process.env.BACKEND_SERVICE_URL
  const response = await fetch(`${backendBaseUrl}/GetCounties`)

  if (!response.ok) {
    throw new Error(`GetCounties failed with status ${response.status}`)
  }

  const counties = await response.json()

  return counties.map((item) => ({ countyCode: String(item.countyCode), name: item.name }))
}
