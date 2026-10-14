export default {
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/public/**',
    '!src/index.js',
    '!src/dev.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text', 'text-summary']
}
