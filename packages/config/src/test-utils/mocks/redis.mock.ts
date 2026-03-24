// ioredis-mock provides a complete in-memory Redis implementation
// suitable for integration tests without a real Redis server
import RedisMock from 'ioredis-mock'

export function createMockRedis() {
  return new RedisMock()
}

export { RedisMock }
