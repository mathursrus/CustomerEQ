// ioredis-mock provides a complete in-memory Redis implementation
// suitable for integration tests without a real Redis server
import RedisMock from 'ioredis-mock'

export type MockRedis = InstanceType<typeof RedisMock>

export function createMockRedis(): MockRedis {
  return new RedisMock()
}

export { RedisMock }
