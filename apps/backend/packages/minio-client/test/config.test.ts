import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadStorageConfig } from '../src/config'

const ENV_KEYS = [
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_USE_SSL',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_REGION',
  'MINIO_DEFAULT_BUCKET',
  'MINIO_PRESIGNED_TTL',
] as const

let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = {}
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
})

describe('loadStorageConfig', () => {
  it('returns the documented defaults when no env is set', () => {
    expect(loadStorageConfig()).toEqual({
      endPoint: 'minio',
      port: 9000,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      region: 'us-east-1',
      defaultBucket: 'ain-rider',
      presignedUrlTtlSeconds: 3600,
    })
  })

  it('reads every value from the environment', () => {
    process.env.MINIO_ENDPOINT = 'storage.internal'
    process.env.MINIO_PORT = '9001'
    process.env.MINIO_USE_SSL = 'true'
    process.env.MINIO_ACCESS_KEY = 'ak'
    process.env.MINIO_SECRET_KEY = 'sk'
    process.env.MINIO_REGION = 'eu-west-1'
    process.env.MINIO_DEFAULT_BUCKET = 'custom-bucket'
    process.env.MINIO_PRESIGNED_TTL = '60'

    expect(loadStorageConfig()).toEqual({
      endPoint: 'storage.internal',
      port: 9001,
      useSSL: true,
      accessKey: 'ak',
      secretKey: 'sk',
      region: 'eu-west-1',
      defaultBucket: 'custom-bucket',
      presignedUrlTtlSeconds: 60,
    })
  })

  it('treats any useSSL value other than "true" as false', () => {
    process.env.MINIO_USE_SSL = 'yes'
    expect(loadStorageConfig().useSSL).toBe(false)

    process.env.MINIO_USE_SSL = '1'
    expect(loadStorageConfig().useSSL).toBe(false)
  })
})
