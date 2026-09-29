import path from 'path'
import { fileURLToPath } from 'url'
import Hapi from '@hapi/hapi'
import Inert from '@hapi/inert'


const __dirname = path.dirname(fileURLToPath(import.meta.url))


const createServer = async () => {
  const server = Hapi.server({
    port: process.env.PORT || 3100,
    host: '0.0.0.0'
  })

  await server.register([Inert])

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
    handler: async (request, h) => {
        return {"message":"You have hit the landing page"};
    }
  });

  server.route({
    method: 'GET',
    path: '/submissions',
    handler: async (request, h) => {
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

        // Return standard JSON response back to the port 3000 middleman
        return {
            results: mockSubmissions,
            totalCount: mockSubmissions.length
        };
    }
  });

  return server
}

export default createServer
