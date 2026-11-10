import { initAll } from 'govuk-frontend'
import accessibleAutocomplete from 'accessible-autocomplete'

initAll()

const clientSelect = document.querySelector('select#client')
const animalAddressSelect = document.querySelector('select#animalAddress')

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
