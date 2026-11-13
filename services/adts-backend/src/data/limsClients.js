const splitAddress = (address = '') => {
  const [addressLine1 = '', addressLine2 = '', addressLine3 = ''] = address.split(',').map((part) => part.trim())
  return { addressLine1, addressLine2, addressLine3 }
}

// Converts a LIMS client (v1 field names) into the form field names used by the UI.
export const mapLimsClient = (limsClient, countyNames) => ({
  clientId: limsClient.clientId,
  name: limsClient.name,
  farmName: limsClient.farm?.trim() ?? '',
  ...splitAddress(limsClient.address),
  county: countyNames.get(String(limsClient.county)) ?? '',
  postcode: limsClient.postcode?.trim() ?? '',
  cph: limsClient.cphh ?? ''
})
