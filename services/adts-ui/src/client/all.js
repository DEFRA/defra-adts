import { initAll } from 'govuk-frontend'
import accessibleAutocomplete from 'accessible-autocomplete'

initAll()

const clientSelect = document.querySelector('select#client')

const speciesSelect = document.querySelector('select#species')

if (speciesSelect) {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: speciesSelect.dataset.defaultValue,
    selectElement: speciesSelect
  })
}

if (clientSelect) {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: clientSelect.dataset.defaultValue,
    selectElement: clientSelect
  })

  const editClientButton = document.querySelector('[data-client-edit-button]')

  if (editClientButton) {
    const syncEditButton = () => {
      editClientButton.hidden = !clientSelect.value
    }

    clientSelect.addEventListener('change', syncEditButton)
    syncEditButton()
  }
}

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
