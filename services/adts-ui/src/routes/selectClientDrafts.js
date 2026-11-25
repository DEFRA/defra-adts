import {
  animalAddressFieldNames,
  clientFieldNames,
  getAnimalAddressFieldValues,
  getClientFieldValues,
  getClientLabel
} from './selectClientView.js'

export const hasSubmittedClientFields = (payload) =>
  clientFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))

const getAnimalAddressDetailsForLocation = (payload, savedDetails, animalAddressClient) => {
  const hasSubmittedFields = animalAddressFieldNames.some((fieldName) => Object.hasOwn(payload, fieldName))
  if (hasSubmittedFields) {
    return getAnimalAddressFieldValues(payload)
  }
  return savedDetails.animalAddressDetails ||
    (animalAddressClient ? getClientFieldValues(animalAddressClient) : getClientFieldValues())
}

export const getAnimalLocation = (payload, formData, animalAddressClient) => {
  const savedDetails = formData.clientDetails || {}

  return {
    animalsAtClientAddress: payload.animalsAtClientAddress ??
      savedDetails.animalsAtClientAddress,
    animalAddressClientId: payload.animalAddressClientId ??
      savedDetails.animalAddressClientId ?? '',
    animalAddress: payload.animalAddress ??
      savedDetails.animalAddress ?? '',
    animalAddressDetails: getAnimalAddressDetailsForLocation(payload, savedDetails, animalAddressClient)
  }
}

export const getSubmittedClientDetails = (payload, selectedClient, formData) => {
  if (hasSubmittedClientFields(payload)) {
    return {
      ...getClientFieldValues(payload),
      ...(selectedClient && { clientId: selectedClient.clientId })
    }
  }

  if (!selectedClient) {
    return formData.clientDetails || getClientFieldValues()
  }

  const savedDetails = formData.clientDetails
  if (savedDetails?.clientId !== selectedClient.clientId) {
    return getClientFieldValues(selectedClient)
  }

  return { ...getClientFieldValues(selectedClient), ...savedDetails }
}

export const saveClientDraftForAnimalAddress = ({
  request,
  submissionFormStateKey,
  submissionFormState,
  formData,
  payload,
  selectedClient,
  selectedAnimalAddress,
  startNewAnimalAddress = false
}) => {
  const clientDetails = { ...getSubmittedClientDetails(payload, selectedClient, formData) }
  const animalLocation = selectedAnimalAddress
    ? {
        animalAddressClientId: String(selectedAnimalAddress.clientId),
        animalAddress: getClientLabel(selectedAnimalAddress)
      }
    : {}
  if (startNewAnimalAddress) {
    delete clientDetails.animalAddressClientId
    delete clientDetails.animalAddress
    delete clientDetails.animalAddressDetails
  }

  request.yar.set(submissionFormStateKey, {
    ...submissionFormState,
    formData: {
      ...formData,
      clientDetails: {
        ...clientDetails,
        animalsAtClientAddress: 'no',
        ...animalLocation
      }
    }
  })
  request.yar.touch()
}

export const saveClientDraftForAddress = (
  request,
  submissionFormStateKey,
  submissionFormState,
  formData,
  payload,
  selectedClient,
  selectedAnimalAddress
) => {
  const clientDetails = {
    ...getSubmittedClientDetails(payload, selectedClient, formData),
    ...(selectedClient && { clientId: selectedClient.clientId })
  }
  const animalLocation = getAnimalLocation(payload, formData, selectedAnimalAddress)

  request.yar.set(submissionFormStateKey, {
    ...submissionFormState,
    formData: {
      ...formData,
      clientDetails: { ...clientDetails, ...animalLocation }
    }
  })
  request.yar.touch()
}
