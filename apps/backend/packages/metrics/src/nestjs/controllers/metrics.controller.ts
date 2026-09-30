import { Controller, Get, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { register } from '../../index';

@Controller('metrics')
export class MetricsController {
  @Get()
  async getMetrics(@Res() res: FastifyReply) {
    res.header('Content-Type', register.contentType);
    res.send(await register.metrics());
  }
}
