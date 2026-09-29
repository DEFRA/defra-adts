import Code from '@hapi/code';
import createServer from '../../src/app.js'; // Adjust path

const { expect } = Code;

describe('LIMS Backend Proxy - Unit Tests', () => {
  let server;

  before(async () => {
    server = await createServer();
  });

  after(async () => {
    await server.stop();
  });

  it('should forward parameters and return a valid payload payload schema', async () => {
    // Injecting a request simulates the end-to-end Hapi cycle cleanly
    const res = await server.inject({
      method: 'GET',
      url: '/submissions?client=MCDONALD&status=submitted'
    });

    expect(res.statusCode).to.equal(200);
    
    const data = JSON.parse(res.payload);
    expect(data.results).to.be.an.array();
    expect(data.totalCount).to.be.a.number();
    expect(data.results[1].client).to.equal('MCDONALD');
  });
});
