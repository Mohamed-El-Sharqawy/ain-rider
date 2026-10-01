import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import type { FastifyReply } from 'fastify';
import { MetricsController } from '../../src/nestjs/controllers/metrics.controller';
import { promRegister as register } from '../../src';

describe('MetricsController', () => {
  test('responds with the prometheus payload and content type', async () => {
    const controller = new MetricsController();
    const res = {
      header: vi.fn(),
      send: vi.fn(),
    } as unknown as FastifyReply;

    await controller.getMetrics(res);

    expect(res.header).toHaveBeenCalledExactlyOnceWith('Content-Type', register.contentType);
    expect(res.send).toHaveBeenCalledTimes(1);
    expect(typeof res.send.mock.calls[0][0]).toBe('string');
  });
});
