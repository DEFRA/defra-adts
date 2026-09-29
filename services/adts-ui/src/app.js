import path from 'path'
import { fileURLToPath } from 'url'
import Hapi from '@hapi/hapi'
import Vision from '@hapi/vision'
import Inert from '@hapi/inert'
import nunjucks from 'nunjucks'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const createServer = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3000,
    host: '0.0.0.0'
  })

  await server.register([Vision, Inert])

  server.views({
    engines: {
      njk: {
        compile: (src, options) => (context) => options.environment.renderString(src, context),
        prepare: (options, next) => {
          options.compileOptions.environment = nunjucks.configure(
            [path.join(__dirname, 'views'), path.join(__dirname, '../node_modules/govuk-frontend/dist')],
            { autoescape: true }
          )
          return next()
        }
      }
    },
    relativeTo: __dirname,
    path: 'views'
  })

  // GOV.UK Frontend static assets (fonts, images) served straight from the installed package
  server.route({
    method: 'GET',
    path: '/assets/{param*}',
    handler: {
      directory: {
        path: path.join(__dirname, '../node_modules/govuk-frontend/dist/govuk/assets')
      }
    }
  })

  // Our compiled CSS, built into src/public by `npm run build`
  server.route({
    method: 'GET',
    path: '/assets/css/{param*}',
    handler: {
      directory: {
        path: path.join(__dirname, 'public/css')
      }
    }
  })

  // Our compiled JS, built into src/public by `npm run build`
  server.route({
    method: 'GET',
    path: '/assets/js/{param*}',
    handler: {
      directory: {
        path: path.join(__dirname, 'public/js')
      }
    }
  })

  server.route({
    method: 'GET',
    path: '/',
    handler: (request, h) => h.view('home.njk', {
      user: request.auth.credentials
    })
  })

  server.route({
    method: 'GET',
    path: '/results',
    handler: async (request, h) => {
        // Mock data now contains an array of status tags and dynamic tests data
        const mockSubmissions = [
            {
                id: "4458",
                statuses: ["Draft"],
                samplesTo: "—",
                client: "—",
                clientFarm: "—",
                species: "—",
                clinician: "—",
                orderSubmitted: "—",
                hasTests: false,
                tests: []
            },
            {
                id: "14-M0002-02-26",
                statuses: ["Submitted", "Samples overdue"],
                samplesTo: "APHA Carmarthen",
                client: "OLD MCDONALD",
                clientFarm: "ANIMAL FARM",
                species: "Goat",
                clinician: "Dave Simonds",
                orderSubmitted: "12/Feb/2026",
                hasTests: true,
                tests: [
                    {
                        name: "Worm egg and/or Cocc. Oocyst Count (TC0060)",
                        type: "McMaster method",
                        sampleType: "Caecal Contents",
                        qty: "1"
                    }
                ]
            }
        ];

        return h.view('results', {
            results: mockSubmissions,
            totalCount: mockSubmissions.length,
            filteredValues: {
                client: request.query.client || '',
                clinician: request.query.clinician || '',
                status: request.query.status || 'draft',
                submitted_date: request.query['submitted-date'] || ''
            }
        });
    }
});
  return server
}

export default createServer
