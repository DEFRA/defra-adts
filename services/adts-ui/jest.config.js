export default {
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/public/**',
    '!src/client/**',
    '!src/index.js',
    '!src/dev.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text', 'text-summary']
}
