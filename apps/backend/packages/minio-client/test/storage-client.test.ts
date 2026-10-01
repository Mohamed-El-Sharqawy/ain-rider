import { PassThrough } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { StorageClient } from '../src/storage-client'

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

const captured: any[] = vi.hoisted(() => [])

vi.mock('minio', async () => {
  const { vi } = await import('vitest')
  class Client {
    config: any
    putObject = vi.fn()
    bucketExists = vi.fn()
    makeBucket = vi.fn()
    presignedGetObject = vi.fn()
    presignedPutObject = vi.fn()
    removeObject = vi.fn()
    removeObjects = vi.fn()
    listObjects = vi.fn()
    statObject = vi.fn()
    listBuckets = vi.fn()

    constructor(config: any) {
      this.config = config
      captured.push(this)
    }
  }
  return { Client }
})

let saved: Record<string, string | undefined>
let consoleLog: ReturnType<typeof vi.spyOn>

function setEnv(env: Record<string, string>) {
  for (const [key, value] of Object.entries(env)) {
    process.env[key] = value
  }
}

function newClient(): { storage: StorageClient; minio: any } {
  const storage = new StorageClient()
  return { storage, minio: captured[captured.length - 1] }
}

beforeEach(() => {
  saved = {}
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key]
    delete process.env[key]
  }
  consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
  captured.length = 0
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  vi.restoreAllMocks()
})

describe('StorageClient construction', () => {
  it('builds the minio client from env with the default service name', () => {
    const { minio } = newClient()
    expect(minio.config).toEqual({
      endPoint: 'minio',
      port: 9000,
      useSSL: false,
      accessKey: 'minioadmin',
      secretKey: 'minioadmin',
      region: 'us-east-1',
    })
  })

  it('builds the minio client from custom env', () => {
    setEnv({
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_USE_SSL: 'false',
      MINIO_ACCESS_KEY: 'ak',
      MINIO_SECRET_KEY: 'sk',
      MINIO_REGION: 'eu-west-1',
    })
    const { minio } = newClient()
    expect(minio.config.endPoint).toBe('localhost')
    expect(minio.config.region).toBe('eu-west-1')
  })

  it('exposes the loaded config', () => {
    const { storage } = newClient()
    expect(storage.getConfig()).toMatchObject({
      endPoint: 'minio',
      defaultBucket: 'ain-rider',
      presignedUrlTtlSeconds: 3600,
    })
  })
})

describe('initialize', () => {
  it('does not create an existing bucket', async () => {
    const { storage, minio } = newClient()
    minio.bucketExists.mockResolvedValue(true)
    await storage.initialize()
    expect(minio.bucketExists).toHaveBeenCalledWith('ain-rider')
    expect(minio.makeBucket).not.toHaveBeenCalled()
  })

  it('creates a missing bucket in the configured region', async () => {
    const { storage, minio } = newClient()
    minio.bucketExists.mockResolvedValue(false)
    minio.makeBucket.mockResolvedValue(undefined)
    await storage.initialize()
    expect(minio.makeBucket).toHaveBeenCalledWith('ain-rider', 'us-east-1')
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('"message":"Bucket created"'),
    )
  })

  it('warns instead of throwing when minio is unreachable', async () => {
    const { storage, minio } = newClient()
    minio.bucketExists.mockRejectedValue(new Error('connection refused'))
    await expect(storage.initialize()).resolves.toBeUndefined()
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('Could not verify/create bucket'),
    )
  })
})

describe('upload', () => {
  it('uploads to the default bucket with octet-stream content type', async () => {
    const { storage, minio } = newClient()
    minio.putObject.mockResolvedValue({ etag: 'etag-1' })
    const data = Buffer.from('payload')

    const result = await storage.upload('docs/a.txt', data, data.length)

    expect(minio.putObject).toHaveBeenCalledWith(
      'ain-rider',
      'docs/a.txt',
      data,
      data.length,
      { 'Content-Type': 'application/octet-stream' },
    )
    expect(result).toEqual({
      bucket: 'ain-rider',
      objectName: 'docs/a.txt',
      etag: 'etag-1',
      size: data.length,
      url: 'http://minio:9000/ain-rider/docs/a.txt',
    })
  })

  it('merges custom content type and metadata and honors a custom bucket', async () => {
    const { storage, minio } = newClient()
    minio.putObject.mockResolvedValue({ etag: 'etag-2' })
    const data = Buffer.from('x')

    await storage.upload('b.png', data, 1, {
      bucket: 'other-bucket',
      contentType: 'image/png',
      metadata: { 'X-Owner': 'test' },
    })

    expect(minio.putObject).toHaveBeenCalledWith(
      'other-bucket',
      'b.png',
      data,
      1,
      { 'Content-Type': 'image/png', 'X-Owner': 'test' },
    )
  })

  it('omits the port from the object url for https on 443', async () => {
    setEnv({ MINIO_ENDPOINT: 'storage.example', MINIO_PORT: '443', MINIO_USE_SSL: 'true' })
    const { storage, minio } = newClient()
    minio.putObject.mockResolvedValue({ etag: 'e' })
    const result = await storage.upload('o', Buffer.from('x'), 1)
    expect(result.url).toBe('https://storage.example/ain-rider/o')
  })

  it('omits the port from the object url for http on 80', async () => {
    setEnv({ MINIO_ENDPOINT: 'storage.example', MINIO_PORT: '80', MINIO_USE_SSL: 'false' })
    const { storage, minio } = newClient()
    minio.putObject.mockResolvedValue({ etag: 'e' })
    const result = await storage.upload('o', Buffer.from('x'), 1)
    expect(result.url).toBe('http://storage.example/ain-rider/o')
  })

  it('keeps an explicit https port in the object url', async () => {
    setEnv({ MINIO_ENDPOINT: 'storage.example', MINIO_PORT: '8443', MINIO_USE_SSL: 'true' })
    const { storage, minio } = newClient()
    minio.putObject.mockResolvedValue({ etag: 'e' })
    const result = await storage.upload('o', Buffer.from('x'), 1)
    expect(result.url).toBe('https://storage.example:8443/ain-rider/o')
  })
})

describe('uploadMultiple', () => {
  it('returns an empty list for no files', async () => {
    const { storage } = newClient()
    await expect(storage.uploadMultiple([])).resolves.toEqual([])
  })

  it('uploads each file with its own content type', async () => {
    const { storage, minio } = newClient()
    minio.putObject.mockResolvedValue({ etag: 'e' })
    const a = Buffer.from('a')
    const b = Buffer.from('b')

    const results = await storage.uploadMultiple([
      { objectName: 'a.txt', data: a, contentType: 'text/plain' },
      { objectName: 'b.bin', data: b },
    ])

    expect(results).toHaveLength(2)
    expect(minio.putObject).toHaveBeenNthCalledWith(
      1,
      'ain-rider',
      'a.txt',
      a,
      1,
      { 'Content-Type': 'text/plain' },
    )
    expect(minio.putObject).toHaveBeenNthCalledWith(
      2,
      'ain-rider',
      'b.bin',
      b,
      1,
      { 'Content-Type': 'application/octet-stream' },
    )
  })

  it('falls back to the shared options content type when a file has none', async () => {
    const { storage, minio } = newClient()
    minio.putObject.mockResolvedValue({ etag: 'e' })

    await storage.uploadMultiple([{ objectName: 'c.png', data: Buffer.from('c') }], {
      contentType: 'image/png',
    })

    expect(minio.putObject).toHaveBeenCalledWith(
      'ain-rider',
      'c.png',
      Buffer.from('c'),
      1,
      { 'Content-Type': 'image/png' },
    )
  })
})

describe('presigned urls', () => {
  it('signs a get url with the default ttl and bucket', async () => {
    const { storage, minio } = newClient()
    minio.presignedGetObject.mockResolvedValue('http://signed-get')
    const before = Date.now()

    const result = await storage.getPresignedGetUrl('o')

    expect(minio.presignedGetObject).toHaveBeenCalledWith('ain-rider', 'o', 3600)
    expect(result.url).toBe('http://signed-get')
    expect(result.expiresAt.getTime()).toBeGreaterThanOrEqual(before + 3600_000 - 1000)
    expect(result.expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 3600_000 + 1000)
  })

  it('signs a get url with an explicit ttl and bucket', async () => {
    const { storage, minio } = newClient()
    minio.presignedGetObject.mockResolvedValue('http://signed-get-2')

    await storage.getPresignedGetUrl('o', 120, 'other-bucket')

    expect(minio.presignedGetObject).toHaveBeenCalledWith('other-bucket', 'o', 120)
  })

  it('signs a put url with the default ttl and bucket', async () => {
    const { storage, minio } = newClient()
    minio.presignedPutObject.mockResolvedValue('http://signed-put')

    const result = await storage.getPresignedPutUrl('o')

    expect(minio.presignedPutObject).toHaveBeenCalledWith('ain-rider', 'o', 3600)
    expect(result.url).toBe('http://signed-put')
  })

  it('signs a put url with an explicit ttl and bucket', async () => {
    const { storage, minio } = newClient()
    minio.presignedPutObject.mockResolvedValue('http://signed-put-2')

    await storage.getPresignedPutUrl('o', 60, 'other-bucket')

    expect(minio.presignedPutObject).toHaveBeenCalledWith('other-bucket', 'o', 60)
  })

  it('signs one get url per object key, forwarding ttl and bucket', async () => {
    const { storage, minio } = newClient()
    minio.presignedGetObject.mockImplementation(async (_b: string, name: string) => `u:${name}`)

    const results = await storage.getPresignedUrlsForObjectKeys(['x', 'y'], 60, 'bkt')

    expect(minio.presignedGetObject).toHaveBeenCalledWith('bkt', 'x', 60)
    expect(minio.presignedGetObject).toHaveBeenCalledWith('bkt', 'y', 60)
    expect(results.map((r) => r.url)).toEqual(['u:x', 'u:y'])
    expect(results[0].expiresAt.getTime()).toBeGreaterThan(Date.now() + 55_000)
  })
})

describe('delete', () => {
  it('removes an object from the default bucket', async () => {
    const { storage, minio } = newClient()
    minio.removeObject.mockResolvedValue(undefined)
    await storage.delete('o')
    expect(minio.removeObject).toHaveBeenCalledWith('ain-rider', 'o')
  })

  it('removes an object from a custom bucket', async () => {
    const { storage, minio } = newClient()
    minio.removeObject.mockResolvedValue(undefined)
    await storage.delete('o', 'bkt')
    expect(minio.removeObject).toHaveBeenCalledWith('bkt', 'o')
  })
})

describe('deleteMany', () => {
  it('removes all objects from the default bucket', async () => {
    const { storage, minio } = newClient()
    minio.removeObjects.mockResolvedValue([])
    await storage.deleteMany(['a', 'b'])
    expect(minio.removeObjects).toHaveBeenCalledWith('ain-rider', [
      { name: 'a' },
      { name: 'b' },
    ])
  })

  it('removes all objects from a custom bucket', async () => {
    const { storage, minio } = newClient()
    minio.removeObjects.mockResolvedValue([])
    await storage.deleteMany(['a'], 'bkt')
    expect(minio.removeObjects).toHaveBeenCalledWith('bkt', [{ name: 'a' }])
  })
})

describe('listObjects', () => {
  function objectStream() {
    return new PassThrough({ objectMode: true })
  }

  it('collects listed objects and fills in missing attributes', async () => {
    const { storage, minio } = newClient()
    const stream = objectStream()
    minio.listObjects.mockReturnValue(stream)
    const lastModified = new Date('2026-01-01T00:00:00Z')

    const promise = storage.listObjects('prefix/', 'bkt')
    stream.write({ name: 'prefix/a', size: 5, lastModified, etag: 'e1' })
    stream.write({ name: undefined })
    stream.write({ name: 'prefix/b' })
    stream.end()

    await expect(promise).resolves.toEqual([
      { objectName: 'prefix/a', size: 5, lastModified, etag: 'e1' },
      {
        objectName: 'prefix/b',
        size: 0,
        lastModified: expect.any(Date),
        etag: '',
      },
    ])
    expect(minio.listObjects).toHaveBeenCalledWith('bkt', 'prefix/', true)
  })

  it('lists from the default bucket when none is given', async () => {
    const { storage, minio } = newClient()
    const stream = objectStream()
    minio.listObjects.mockReturnValue(stream)

    const promise = storage.listObjects('p/')
    stream.end()

    await expect(promise).resolves.toEqual([])
    expect(minio.listObjects).toHaveBeenCalledWith('ain-rider', 'p/', true)
  })

  it('rejects and logs when the listing stream errors', async () => {
    const { storage, minio } = newClient()
    const stream = objectStream()
    minio.listObjects.mockReturnValue(stream)

    const promise = storage.listObjects('prefix/', 'missing-bucket')
    stream.emit('error', new Error('NoSuchBucket'))

    await expect(promise).rejects.toThrow('NoSuchBucket')
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('List objects failed'),
    )
  })
})

describe('exists', () => {
  it('returns true when statObject succeeds', async () => {
    const { storage, minio } = newClient()
    minio.statObject.mockResolvedValue({ size: 1 })
    await expect(storage.exists('o')).resolves.toBe(true)
    expect(minio.statObject).toHaveBeenCalledWith('ain-rider', 'o')
  })

  it('returns false when statObject fails', async () => {
    const { storage, minio } = newClient()
    minio.statObject.mockRejectedValue(new Error('NotFound'))
    await expect(storage.exists('o', 'bkt')).resolves.toBe(false)
    expect(minio.statObject).toHaveBeenCalledWith('bkt', 'o')
  })
})

describe('ping', () => {
  it('returns true when listBuckets succeeds', async () => {
    const { storage, minio } = newClient()
    minio.listBuckets.mockResolvedValue([])
    await expect(storage.ping()).resolves.toBe(true)
  })

  it('returns false when listBuckets fails', async () => {
    const { storage, minio } = newClient()
    minio.listBuckets.mockRejectedValue(new Error('InvalidAccessKeyId'))
    await expect(storage.ping()).resolves.toBe(false)
  })
})

describe('log service name', () => {
  it('uses the configured service name in log lines', async () => {
    const storage = new StorageClient({ serviceName: 'trip-service' })
    const minio = captured[captured.length - 1]
    minio.putObject.mockResolvedValue({ etag: 'e' })
    await storage.upload('o', Buffer.from('x'), 1)
    expect(consoleLog).toHaveBeenCalledWith(
      expect.stringContaining('"service":"trip-service"'),
    )
  })
})
