import { BAD_GATEWAY_STATUS } from './submissionViewHelpers.js'
import { DRAFT_SAVE_ERROR, persistSubmissionDraft } from './submissionDrafts.js'
import { getClientFieldValues, renderClientDetailsPage } from './selectClientView.js'

const clearClientDetails = (clientDetails) => {
  const clearedDetails = { ...clientDetails, ...getClientFieldValues() }
  delete clearedDetails.clientId
  return clearedDetails
}

const saveClearedFormData = async ({
  request,
  submissionFormStateKey,
  submissionFormState,
  formData
}) => {
  if (submissionFormState.draftId) {
    return persistSubmissionDraft(request, submissionFormStateKey, 'clientDetails', formData)
  }

  request.yar.set(submissionFormStateKey, { ...submissionFormState, formData })
  request.yar.touch()
  return true
}

const renderDraftSaveError = (h, submissionFormState, clients, counties) =>
  renderClientDetailsPage(
    h,
    submissionFormState,
    clients,
    counties,
    { saveError: DRAFT_SAVE_ERROR }
  ).code(BAD_GATEWAY_STATUS)

export const handleClearClientIntent = async ({
  request,
  h,
  submissionFormStateKey,
  submissionFormState,
  formData,
  payload,
  clients,
  counties,
  selectedAnimalAddress,
  getAnimalLocation
}) => {
  const clearedFormData = {
    ...formData,
    clientDetails: clearClientDetails(formData.clientDetails || {})
  }

  if (!await saveClearedFormData({
    request,
    submissionFormStateKey,
    submissionFormState,
    formData: clearedFormData
  })) {
    return renderDraftSaveError(h, submissionFormState, clients, counties)
  }

  return renderClientDetailsPage(
    h,
    { ...submissionFormState, formData: clearedFormData },
    clients,
    counties,
    {
      selectedClientId: '',
      ...getAnimalLocation(payload, clearedFormData, selectedAnimalAddress)
    }
  )
}

export const handleClearAnimalAddressIntent = async ({
  request,
  h,
  submissionFormStateKey,
  submissionFormState,
  formData,
  clients,
  counties
}) => {
  const clientDetails = { ...formData.clientDetails }
  delete clientDetails.animalAddressClientId
  delete clientDetails.animalAddress
  delete clientDetails.animalAddressDetails
  const clearedFormData = { ...formData, clientDetails }

  if (!await saveClearedFormData({
    request,
    submissionFormStateKey,
    submissionFormState,
    formData: clearedFormData
  })) {
    return renderDraftSaveError(h, submissionFormState, clients, counties)
  }

  return renderClientDetailsPage(
    h,
    { ...submissionFormState, formData: clearedFormData },
    clients,
    counties,
    {
      animalAddressClientId: '',
      animalAddress: '',
      animalAddressDetails: getClientFieldValues()
    }
  )
}
