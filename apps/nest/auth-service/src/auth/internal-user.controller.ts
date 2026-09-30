import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { InternalAuthGuard } from './guards/internal-auth.guard';

@ApiTags('Internal')
@Controller('internal/users')
export class InternalUserController {
  constructor(private prisma: PrismaService) {}

  @Get(':id/basic')
  @UseGuards(InternalAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Internal only: Get basic user info for matching/assignment' })
  async getBasicInfo(@Param('id') id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        rider: {
          select: { rating: true },
        },
        driver: {
          select: { rating: true },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber,
      role: user.role,
      rating: user.role === 'RIDER' ? user.rider?.rating : user.driver?.rating,
    };
  }
}
