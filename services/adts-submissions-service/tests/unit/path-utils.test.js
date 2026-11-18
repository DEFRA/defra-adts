import { describe, expect, test } from '@jest/globals'
import { trimSlashes } from '../../src/path-utils.js'

describe('trimSlashes', () => {
  test.each([
    ['/LIMSRestAPi/', 'LIMSRestAPi'],
    ['///a/b///', 'a/b'],
    ['a/b', 'a/b'],
    ['///', ''],
    ['', '']
  ])('trims leading and trailing slashes from %j', (input, expected) => {
    expect(trimSlashes(input)).toBe(expected)
  })
})
