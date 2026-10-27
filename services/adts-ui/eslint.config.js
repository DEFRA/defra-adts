import neostandard from 'neostandard'

export default [
  { ignores: ['src/public/**', 'dist/**', 'build/**', 'coverage/**', '**/*.min.js'] },
  ...neostandard()
]
