import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const staticAssets = (server) => {
  server.route([
    {
      method: 'GET',
      path: '/assets/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../../node_modules/govuk-frontend/dist/govuk/assets')
        }
      }
    },
    {
      method: 'GET',
      path: '/assets/css/accessible-autocomplete.min.css',
      handler: {
        file: {
          path: path.join(__dirname, '../../node_modules/accessible-autocomplete/dist/accessible-autocomplete.min.css')
        }
      }
    },
    {
      method: 'GET',
      path: '/assets/css/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../public/css')
        }
      }
    },
    {
      method: 'GET',
      path: '/assets/js/{param*}',
      handler: {
        directory: {
          path: path.join(__dirname, '../public/js')
        }
      }
    }
  ])
}

export default staticAssets
