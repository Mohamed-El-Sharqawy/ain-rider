import { Controller, Post, Get, Param, Body, Patch, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateRefundDto } from './dto/create-refund.dto';
import { InternalAuthGuard } from '../auth/internal-auth.guard';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(InternalAuthGuard)
export class PaymentsController {
  constructor(private paymentsService: PaymentsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a cash payment record for a trip' })
  create(@Body() body: CreatePaymentDto) {
    return this.paymentsService.createPayment(body);
  }

  @Patch(':id/confirm-cash')
  @ApiOperation({ summary: 'Confirm cash has been collected by driver' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: { properties: { collectedBy: { type: 'string' } } } })
  confirmCash(
    @Param('id') id: string,
    @Body('collectedBy') collectedBy: string,
  ) {
    return this.paymentsService.confirmCashCollection(id, collectedBy);
  }

  @Patch(':id/mark-failed')
  @ApiOperation({ summary: 'Mark payment as failed (e.g., rider did not pay)' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: { properties: { reason: { type: 'string' } } } })
  markFailed(
    @Param('id') id: string,
    @Body('reason') reason: string,
  ) {
    return this.paymentsService.markPaymentFailed(id, reason);
  }

  @Post(':id/refund')
  @ApiOperation({ summary: 'Create a refund for a payment' })
  @ApiParam({ name: 'id', type: String })
  refund(
    @Param('id') id: string,
    @Body() body: CreateRefundDto,
  ) {
    return this.paymentsService.createRefund(id, body.amount, body.reason);
  }

  @Get('trip/:tripId')
  @ApiOperation({ summary: 'Get payment by trip ID' })
  @ApiParam({ name: 'tripId', type: String })
  findByTrip(@Param('tripId') tripId: string) {
    return this.paymentsService.findByTrip(tripId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get payment by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.paymentsService.findById(id);
  }
}
