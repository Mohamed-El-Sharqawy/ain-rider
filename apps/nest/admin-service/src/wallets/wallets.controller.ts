import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { WalletsService } from './wallets.service';
import { AdminGuard } from '../auth/admin.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { CreditDebitWalletDto } from './dto/credit-debit-wallet.dto';
import { ProcessWithdrawalDto } from './dto/process-withdrawal.dto';

@ApiTags('Wallets')
@ApiBearerAuth()
@UseGuards(AdminGuard, RolesGuard)
@Controller()
export class WalletsController {
  constructor(private walletsService: WalletsService) {}

  @Get('wallets/user/:userId')
  @ApiOperation({ summary: 'Get wallet by user ID' })
  @ApiParam({ name: 'userId', type: String })
  findByUser(@Param('userId') userId: string) {
    return this.walletsService.findByUser(userId);
  }

  @Post('wallets/credit')
  @ApiOperation({ summary: 'Credit a user wallet' })
  credit(@Body() body: CreditDebitWalletDto) {
    return this.walletsService.credit(body.userId, body.amount, body.description, body.referenceId);
  }

  @Post('wallets/debit')
  @ApiOperation({ summary: 'Debit a user wallet' })
  debit(@Body() body: CreditDebitWalletDto) {
    return this.walletsService.debit(body.userId, body.amount, body.description, body.referenceId);
  }

  @Get('withdrawals')
  @ApiOperation({ summary: 'Get all withdrawals' })
  @ApiQuery({ name: 'status', required: false, type: String })
  findWithdrawals(@Query('status') status?: string) {
    return this.walletsService.findWithdrawals(status);
  }

  @Roles('ADMIN')
  @Patch('withdrawals/:id/process')
  @ApiOperation({ summary: 'Process a withdrawal request' })
  @ApiParam({ name: 'id', type: String })
  processWithdrawal(
    @Param('id') id: string,
    @Body() body: ProcessWithdrawalDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.walletsService.processWithdrawal(id, user.sub, body.approve, body.rejectionReason);
  }
}
