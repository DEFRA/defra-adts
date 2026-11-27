// Makes the CDP Defra ID stub accept the authorize request that the Defra ID plugin sends.
// Idempotent. Usage: node patch-stub.mjs <path to stub clone>
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]

const patch = (relativePath, marker, from, to) => {
  const file = join(root, relativePath)
  const source = readFileSync(file, 'utf8')
  if (source.includes(marker)) {
    return
  }
  if (!source.includes(from)) {
    throw new Error(`Cannot patch ${relativePath}: the stub has changed upstream`)
  }
  writeFileSync(file, source.replace(from, to))
}

// The plugin always sends "p" and "response_mode"; the stub honours form_post after validation.
patch(
  'src/server/oidc/helpers/schemas/login-validation.js',
  'response_mode',
  'forceReselection: Joi.string().optional()',
  'forceReselection: Joi.string().optional(),\n  p: Joi.string().optional(),\n  response_mode: Joi.string().optional()'
)

// The stub stores the nonce as oidcNonce but reads session.nonce when signing the ID token.
patch(
  'src/server/oidc/helpers/oidc-crypto.js',
  'session.oidcNonce',
  'claim.nonce = session.nonce',
  'claim.nonce = session.oidcNonce'
)

// The plugin requests the bare client ID as a scope (Defra ID convention).
patch(
  'src/server/oidc/helpers/validate-scope.js',
  'bareClientId',
  ".filter((s) => !oidcConfig.scopesSupported.includes(s))",
  ".filter((s) => !oidcConfig.scopesSupported.includes(s))\n    // bareClientId\n    .filter((s) => !/^[0-9a-f-]{36}$/i.test(s))"
)

// Safari rejects the local HTTP Secure cookie needed by the plugin's form_post callback.
// The app accepts query callbacks, so the local stub returns the code through a top-level GET.
patch(
  'src/server/oidc/controllers/authorize-controller.js',
  'LOCAL_OIDC_USE_GET_CALLBACK',
  "if (request.query.response_mode === 'form_post') {",
  "if (request.query.response_mode === 'form_post' && process.env.LOCAL_OIDC_USE_GET_CALLBACK !== 'true') {"
)

// Give the documented mapped demo email a stable OIDC subject; other registrations stay random.
patch(
  'src/server/registration/controllers/register-api-controller.js',
  "payload.email?.toLowerCase() === 'demo.mapped@example.com'",
  'userId = crypto.randomUUID()',
  "userId = payload.email?.toLowerCase() === 'demo.mapped@example.com'\n" +
    "          ? 'b198e14c-19e4-4a94-8953-72b4a1f2c835'\n" +
    '          : crypto.randomUUID()'
)

patch(
  'src/server/registration/controllers/registration-controller.js',
  'import { removeRegistration }',
  "import { findRegistration } from '#server/registration/helpers/find-registration.js'",
  "import { findRegistration, findRegistrationByEmail } from '#server/registration/helpers/find-registration.js'\n" +
    "import { removeRegistration } from '#server/registration/helpers/remove-registration.js'"
)

patch(
  'src/server/registration/controllers/registration-controller.js',
  "const isMappedDemoEmail = payload.email?.toLowerCase() === 'demo.mapped@example.com'",
  '    const { userId } = payload',
  "    const isMappedDemoEmail = payload.email?.toLowerCase() === 'demo.mapped@example.com'\n" +
    '    if (isMappedDemoEmail) {\n' +
    '      const existingRegistration = await findRegistrationByEmail(\n' +
    '        payload.email,\n' +
    '        request.registrationsStore\n' +
    '      )\n' +
    '      if (existingRegistration) {\n' +
    '        await removeRegistration(existingRegistration.userId, request.registrationsStore)\n' +
    '      }\n' +
    '    }\n' +
    '    const userId = isMappedDemoEmail\n' +
    "      ? 'b198e14c-19e4-4a94-8953-72b4a1f2c835'\n" +
    '      : payload.userId'
)
