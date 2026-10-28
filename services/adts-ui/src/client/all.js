import { initAll } from 'govuk-frontend'
import accessibleAutocomplete from 'accessible-autocomplete'

initAll()

const clientSelect = document.querySelector('#client')

const otherSpeciesSelect = document.querySelector('#otherSpecies')

if (otherSpeciesSelect) {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: otherSpeciesSelect.dataset.defaultValue,
    selectElement: otherSpeciesSelect
  })
}

if (clientSelect) {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: clientSelect.dataset.defaultValue,
    selectElement: clientSelect
  })
}

const breedSelect = document.querySelector('#breed')

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
