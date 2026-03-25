/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import multiTenantPlugin from './multiTenant.js'

describe('multiTenantPlugin', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = Fastify()
    await app.register(multiTenantPlugin)

    // Register a simple POST route that echoes back a success payload so we
    // can confirm the request was NOT intercepted.
    app.post('/test', async (_request, _reply) => {
      return { ok: true }
    })

    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('requests that should pass through', () => {
    it('allows a request body that contains no brandId field', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: 'user-123', amount: 50 }),
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ ok: true })
    })

    it('allows a request with no body at all', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ ok: true })
    })

    it('allows a request with an empty body object', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ ok: true })
    })

    it('allows a request body that is an array (non-plain-object body)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify([{ eventType: 'purchase' }]),
      })

      // Arrays do not have 'brandId' as an own property so the hook must pass through.
      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ ok: true })
    })

    it('allows a request body with a field named brandIdExtra (not exact brandId)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandIdExtra: 'brand-abc' }),
      })

      expect(response.statusCode).toBe(200)
      expect(JSON.parse(response.body)).toEqual({ ok: true })
    })
  })

  describe('requests that should be rejected', () => {
    it('rejects a request body that contains a brandId field with status 400', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId: 'brand-xyz', userId: 'user-456' }),
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns the correct error message when brandId is present in the body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId: 'brand-xyz' }),
      })

      const body = JSON.parse(response.body)
      expect(body.error).toBe('brandId must not be provided in request body')
    })

    it('rejects even when brandId is null (the key is present regardless of value)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId: null, name: 'test' }),
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('brandId must not be provided in request body')
    })

    it('rejects when brandId is the only field in the body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/test',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ brandId: 'brand-only' }),
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
