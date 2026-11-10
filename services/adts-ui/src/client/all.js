import { initAll } from 'govuk-frontend'
import accessibleAutocomplete from 'accessible-autocomplete'

initAll()

const clientSelect = document.querySelector('select#client')
const animalAddressSelect = document.querySelector('select#animalAddress')
const createClientAddressLink = document.querySelector('[data-create-client-address-link]')
const createAnimalAddressLink = document.querySelector('[data-create-animal-address-link]')
const animalAddressSelection = document.querySelector('#animal-address-selection')

const speciesSelect = document.querySelector('select#species')

if (speciesSelect) {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: speciesSelect.dataset.defaultValue,
    selectElement: speciesSelect
  })
}

const enhanceAddressLookup = (selectElement, editButton) => {
  const syncEditButton = () => {
    if (editButton) {
      editButton.hidden = !selectElement.value
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
    if (!form) return

    event.preventDefault()
    form.action = '/submission-01-client-address/start'
    const intent = document.createElement('input')
    intent.type = 'hidden'
    intent.name = 'intent'
    intent.value = 'newClientAddress'
    form.appendChild(intent)
    form.submit()
  })
}

if (createAnimalAddressLink) {
  createAnimalAddressLink.addEventListener('click', (event) => {
    const form = createAnimalAddressLink.closest('form')
    if (!form) return

    event.preventDefault()
    form.action = '/submission-01-animal-address/start'
    const intent = document.createElement('input')
    intent.type = 'hidden'
    intent.name = 'intent'
    intent.value = 'newAnimalAddress'
    form.appendChild(intent)
    form.submit()
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
