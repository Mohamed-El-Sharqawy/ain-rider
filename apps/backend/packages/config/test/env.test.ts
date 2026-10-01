import { describe, expect, it } from 'vitest'
import { optionalEnv, requireEnv, requireEnvBool, requireEnvInt } from '../src'

describe('requireEnv', () => {
  it('returns the value when the variable is set', () => {
    process.env.CONFIG_TEST_SET = 'some-value'
    expect(requireEnv('CONFIG_TEST_SET')).toBe('some-value')
  })

  it('throws when the variable is unset', () => {
    delete process.env.CONFIG_TEST_UNSET
    expect(() => requireEnv('CONFIG_TEST_UNSET')).toThrowError(
      'Missing required environment variable: CONFIG_TEST_UNSET',
    )
  })

  it('throws when the variable is an empty string', () => {
    process.env.CONFIG_TEST_EMPTY = ''
    expect(() => requireEnv('CONFIG_TEST_EMPTY')).toThrowError(
      'Missing required environment variable: CONFIG_TEST_EMPTY',
    )
  })
})

describe('optionalEnv', () => {
  it('returns the value when the variable is set', () => {
    process.env.CONFIG_TEST_OPTIONAL = 'present'
    expect(optionalEnv('CONFIG_TEST_OPTIONAL', 'fallback')).toBe('present')
  })

  it('returns the default when the variable is unset', () => {
    delete process.env.CONFIG_TEST_OPTIONAL_UNSET
    expect(optionalEnv('CONFIG_TEST_OPTIONAL_UNSET', 'fallback')).toBe('fallback')
  })
})

describe('requireEnvInt', () => {
  it('parses an integer value', () => {
    process.env.CONFIG_TEST_INT = '42'
    expect(requireEnvInt('CONFIG_TEST_INT')).toBe(42)
  })

  it('throws when the value is not an integer', () => {
    process.env.CONFIG_TEST_INT_BAD = 'not-a-number'
    expect(() => requireEnvInt('CONFIG_TEST_INT_BAD')).toThrowError(
      'Environment variable CONFIG_TEST_INT_BAD must be an integer, got: not-a-number',
    )
  })
})

describe('requireEnvBool', () => {
  const cases: Array<[string, boolean]> = [
    ['true', true],
    ['1', true],
    ['false', false],
    ['0', false],
    ['yes', false],
  ]

  it.each(cases)('maps %s to %s', (raw, expected) => {
    process.env.CONFIG_TEST_BOOL = raw
    expect(requireEnvBool('CONFIG_TEST_BOOL')).toBe(expected)
  })
})
