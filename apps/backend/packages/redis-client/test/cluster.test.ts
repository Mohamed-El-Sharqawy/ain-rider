import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRedisCluster } from '../src/cluster'

interface CapturedCluster {
  nodes: Array<{ host: string; port: number }>
  options: Record<string, any>
  handlers: Map<string, () => void>
}

const captured: CapturedCluster[] = []

vi.mock('ioredis', () => {
  class Cluster {
    nodes: Array<{ host: string; port: number }>
    options: Record<string, any>
    handlers = new Map<string, () => void>()

    constructor(nodes: Array<{ host: string; port: number }>, options: Record<string, any>) {
      this.nodes = nodes
      this.options = options
      captured.push(this)
    }

    on(event: string, handler: () => void) {
      this.handlers.set(event, handler)
    }
  }
  return { default: { Cluster }, Cluster }
})

let consoleLog: ReturnType<typeof vi.spyOn>
let consoleError: ReturnType<typeof vi.spyOn>
let savedNatMap: string | undefined

beforeEach(() => {
  consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
  savedNatMap = process.env.REDIS_NAT_MAP
  captured.length = 0
})

afterEach(() => {
  if (savedNatMap === undefined) delete process.env.REDIS_NAT_MAP
  else process.env.REDIS_NAT_MAP = savedNatMap
  vi.restoreAllMocks()
})

function lastCluster(): CapturedCluster {
  return captured[captured.length - 1]
}

describe('createRedisCluster node parsing', () => {
  it('splits host:port strings into node addresses', () => {
    createRedisCluster({ nodes: ['localhost:6379', '10.0.0.5:6380'] })
    expect(lastCluster().nodes).toEqual([
      { host: 'localhost', port: 6379 },
      { host: '10.0.0.5', port: 6380 },
    ])
  })
})

describe('createRedisCluster option defaults', () => {
  it('applies ready-check and retry defaults when config omits them', () => {
    createRedisCluster({ nodes: ['localhost:6379'] })
    const redisOptions = lastCluster().options.redisOptions
    expect(redisOptions.enableReadyCheck).toBe(true)
    expect(redisOptions.maxRetriesPerRequest).toBe(3)
    expect(redisOptions.password).toBeUndefined()
    expect(redisOptions.keyPrefix).toBeUndefined()
  })

  it('passes through explicit credentials, prefix and tuning', () => {
    createRedisCluster({
      nodes: ['localhost:6379'],
      password: 'secret',
      keyPrefix: 'test:',
      enableReadyCheck: false,
      maxRetriesPerRequest: 7,
    })
    const redisOptions = lastCluster().options.redisOptions
    expect(redisOptions.password).toBe('secret')
    expect(redisOptions.keyPrefix).toBe('test:')
    expect(redisOptions.enableReadyCheck).toBe(false)
    expect(redisOptions.maxRetriesPerRequest).toBe(7)
  })
})

describe('natMap resolution', () => {
  it('uses the config natMap when provided, even if env is set', () => {
    process.env.REDIS_NAT_MAP = 'env-host:6379>localhost:6379'
    const configMap = { 'cfg-host:6379': { host: 'localhost', port: 7000 } }
    createRedisCluster({ nodes: ['localhost:6379'], natMap: configMap })
    expect(lastCluster().options.natMap).toEqual(configMap)
  })

  it('parses REDIS_NAT_MAP entries and skips malformed ones', () => {
    process.env.REDIS_NAT_MAP =
      'redis-1:6379>localhost:6379,broken,redis-2:6379>localhost:6380,>only-to,only-from>'
    createRedisCluster({ nodes: ['localhost:6379'] })
    expect(lastCluster().options.natMap).toEqual({
      'redis-1:6379': { host: 'localhost', port: 6379 },
      'redis-2:6379': { host: 'localhost', port: 6380 },
    })
  })

  it('ignores REDIS_NAT_MAP when no entry parses', () => {
    process.env.REDIS_NAT_MAP = '>x,x>'
    createRedisCluster({ nodes: ['localhost:6379'] })
    expect(lastCluster().options.natMap).toBeUndefined()
  })

  it('leaves natMap undefined when neither config nor env provide one', () => {
    delete process.env.REDIS_NAT_MAP
    createRedisCluster({ nodes: ['localhost:6379'] })
    expect(lastCluster().options.natMap).toBeUndefined()
  })
})

describe('clusterRetryStrategy', () => {
  it('waits 100ms plus 100ms per retry attempt', () => {
    createRedisCluster({ nodes: ['localhost:6379'] })
    const strategy = lastCluster().options.clusterRetryStrategy as (t: number) => number
    expect(strategy(0)).toBe(100)
    expect(strategy(5)).toBe(600)
  })

  it('caps the backoff at 2000ms', () => {
    createRedisCluster({ nodes: ['localhost:6379'] })
    const strategy = lastCluster().options.clusterRetryStrategy as (t: number) => number
    expect(strategy(25)).toBe(2000)
  })
})

describe('cluster event handlers', () => {
  it('logs each lifecycle event on the matching handler', () => {
    createRedisCluster({ nodes: ['localhost:6379'] })
    const { handlers } = lastCluster()

    handlers.get('connect')!()
    expect(consoleLog).toHaveBeenCalledWith('[Redis Cluster] Connected')

    handlers.get('ready')!()
    expect(consoleLog).toHaveBeenCalledWith('[Redis Cluster] Ready')

    handlers.get('error')!(new Error('node down'))
    expect(consoleError).toHaveBeenCalledWith('[Redis Cluster] Error:', expect.any(Error))

    handlers.get('close')!()
    expect(consoleLog).toHaveBeenCalledWith('[Redis Cluster] Connection closed')

    handlers.get('reconnecting')!()
    expect(consoleLog).toHaveBeenCalledWith('[Redis Cluster] Reconnecting...')

    handlers.get('end')!()
    expect(consoleLog).toHaveBeenCalledWith('[Redis Cluster] Connection ended')
  })
})
