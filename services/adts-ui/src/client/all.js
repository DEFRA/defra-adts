import { initAll } from 'govuk-frontend'
import accessibleAutocomplete from 'accessible-autocomplete'

initAll()

const clientSelect = document.querySelector('#client')

if (clientSelect) {
  accessibleAutocomplete.enhanceSelectElement({
    defaultValue: clientSelect.dataset.defaultValue,
    selectElement: clientSelect
  })
}
