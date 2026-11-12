import { initAll } from 'govuk-frontend'
import accessibleAutocomplete from 'accessible-autocomplete'

initAll()

const clientSelect = document.querySelector('select#client')
const animalAddressSelect = document.querySelector('select#animalAddress')
const createClientAddressLink = document.querySelector('[data-create-client-address-link]')
const createAnimalAddressLink = document.querySelector('[data-create-animal-address-link]')
const animalAddressSelection = document.querySelector('#animal-address-selection')
const cphInputs = document.querySelectorAll('[data-cph-input]')

const submitAddressStart = (form, action, intentValue) => {
  form.action = action
  let intent = form.querySelector('input[data-address-start-intent]')
  if (!intent) {
    intent = document.createElement('input')
    intent.type = 'hidden'
    intent.name = 'intent'
    intent.dataset.addressStartIntent = 'true'
    form.appendChild(intent)
  }
  intent.value = intentValue
  form.submit()
}

const speciesSelect = document.querySelector('select#species')
const MAX_CPH_DIGITS = 9
const CPH_AREA_DIGITS = 2
const CPH_DISTRICT_DIGITS = 3

const getCphDigitsBeforePosition = (value, position) =>
  value.slice(0, position).replace(/\D/g, '').length

const formatCph = (value) => {
  const digits = value.replace(/\D/g, '').slice(0, MAX_CPH_DIGITS)

  if (digits.length < CPH_AREA_DIGITS) {
    return digits
  }
  if (digits.length < CPH_AREA_DIGITS + CPH_DISTRICT_DIGITS) {
    return `${digits.slice(0, CPH_AREA_DIGITS)}/${digits.slice(CPH_AREA_DIGITS)}`
  }

  return `${digits.slice(0, CPH_AREA_DIGITS)}/${digits.slice(CPH_AREA_DIGITS, CPH_AREA_DIGITS + CPH_DISTRICT_DIGITS)}/${digits.slice(CPH_AREA_DIGITS + CPH_DISTRICT_DIGITS)}`
}

const getCphCaretPosition = (digitsBeforeCaret) =>
  digitsBeforeCaret +
  Number(digitsBeforeCaret >= CPH_AREA_DIGITS) +
  Number(digitsBeforeCaret >= CPH_AREA_DIGITS + CPH_DISTRICT_DIGITS)

const updateCphInput = (input, digits, digitsBeforeCaret) => {
  input.value = formatCph(digits)
  const caretPosition = getCphCaretPosition(digitsBeforeCaret)
  input.setSelectionRange(caretPosition, caretPosition)
}

cphInputs.forEach((input) => {
  input.addEventListener('input', (event) => {
    const { value, selectionStart } = event.target
    const digitsBeforeCaret = getCphDigitsBeforePosition(value, selectionStart)
    updateCphInput(event.target, value.replace(/\D/g, '').slice(0, MAX_CPH_DIGITS), digitsBeforeCaret)
  })

  input.addEventListener('keydown', (event) => {
    const { value, selectionStart, selectionEnd } = event.target
    if (selectionStart !== selectionEnd) {
      return
    }

    const isBackspaceBeforeSlash = event.key === 'Backspace' &&
      value[selectionStart - 1] === '/'
    const isDeleteBeforeSlash = event.key === 'Delete' &&
      value[selectionStart] === '/'

    if (!isBackspaceBeforeSlash && !isDeleteBeforeSlash) {
      return
    }

    const digits = value.replace(/\D/g, '')
    const digitsBeforeCaret = getCphDigitsBeforePosition(value, selectionStart)
    const digitIndex = isBackspaceBeforeSlash ? digitsBeforeCaret - 1 : digitsBeforeCaret
    if (digitIndex < 0 || digitIndex >= digits.length) {
      return
    }

    event.preventDefault()
    const updatedDigits = `${digits.slice(0, digitIndex)}${digits.slice(digitIndex + 1)}`
    const updatedDigitsBeforeCaret = isBackspaceBeforeSlash
      ? digitIndex
      : digitsBeforeCaret
    updateCphInput(event.target, updatedDigits, updatedDigitsBeforeCaret)
  })
})

if (speciesSelect) {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: speciesSelect.dataset.defaultValue,
    selectElement: speciesSelect
  })
}

const enhanceAddressLookup = (selectElement, editButton) => {
  const syncEditButton = () => {
    if (editButton) {
      editButton.hidden = !selectElement.value && editButton.dataset.manualAddress !== 'true'
    }
  }

  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: selectElement.dataset.defaultValue,
    selectElement,
    onConfirm: (query) => {
      const selectedOption = Array.from(selectElement.options)
        .find((option) => (option.textContent || option.innerText) === query)

      if (selectedOption) {
        selectedOption.selected = true
        syncEditButton()
      }
    }
  })

  if (editButton) {
    selectElement.addEventListener('change', syncEditButton)
    syncEditButton()
  }
}

if (clientSelect) {
  enhanceAddressLookup(clientSelect, document.querySelector('[data-client-edit-button]'))
}

if (animalAddressSelect) {
  enhanceAddressLookup(
    animalAddressSelect,
    document.querySelector('[data-animal-address-edit-button]')
  )
}

if (createClientAddressLink) {
  createClientAddressLink.addEventListener('click', (event) => {
    const form = createClientAddressLink.closest('form')
    if (!form) {
      return
    }

    event.preventDefault()
    submitAddressStart(form, '/submission-01-client-address/start', 'newClientAddress')
  })
}

if (createAnimalAddressLink) {
  createAnimalAddressLink.addEventListener('click', (event) => {
    const form = createAnimalAddressLink.closest('form')
    if (!form) {
      return
    }

    event.preventDefault()
    submitAddressStart(form, '/submission-01-animal-address/start', 'newAnimalAddress')
  })
}

if (animalAddressSelection) {
  const animalLocationRadios = document.querySelectorAll('input[name="animalsAtClientAddress"]')
  const syncAnimalAddressVisibility = () => {
    const selectedLocation = Array.from(animalLocationRadios).find((radio) => radio.checked)
    animalAddressSelection.hidden = selectedLocation?.value !== 'no'
  }

  animalLocationRadios.forEach((radio) => {
    radio.addEventListener('change', syncAnimalAddressVisibility)
  })
  syncAnimalAddressVisibility()
}

const countySelects = document.querySelectorAll('select#county, select#animalAddressCounty')

countySelects.forEach((countySelect) => {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: countySelect.dataset.defaultValue,
    inputClasses: 'govuk-!-width-one-half',
    selectElement: countySelect
  })
})

const breedSelect = document.querySelector('select#breed')

if (breedSelect) {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: '',
    selectElement: breedSelect
  })
}

const hideAutocompleteHints = () => {
  document.querySelectorAll('.autocomplete__hint').forEach((hint) => {
    hint.setAttribute('aria-hidden', 'true')
  })
}

hideAutocompleteHints()

const autocompleteHintObserver = new window.MutationObserver(hideAutocompleteHints)
autocompleteHintObserver.observe(document.body, { childList: true, subtree: true })

// Without JavaScript every ID input is shown; extras beyond the chosen number are ignored on submit.
const numberOfAnimals = document.querySelector('#numberOfAnimals')

if (numberOfAnimals) {
  const syncAnimalIds = () => {
    document.querySelectorAll('.app-animal-id').forEach((el) => {
      el.hidden = Number(el.dataset.animalIndex) > Number(numberOfAnimals.value)
    })
  }

  numberOfAnimals.addEventListener('change', syncAnimalIds)
  syncAnimalIds()
}
