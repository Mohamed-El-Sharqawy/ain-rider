import { Controller, Post, Get, Param, Body, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ComplaintsService } from './complaints.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsString, IsOptional, IsEnum, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class PublicCreateComplaintDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  againstUserId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsUUID()
  tripId?: string;

  @ApiProperty()
  @IsString()
  @IsEnum([
    'RIDER_BEHAVIOR',
    'VEHICLE_CONDITION',
    'ROUTE_ISSUE',
    'PAYMENT_ISSUE',
    'SAFETY_CONCERN',
    'APP_ISSUE',
    'OTHER',
    'LOST_ITEM',
  ])
  type: string;

  @ApiProperty()
  @IsString()
  subject: string;

  @ApiProperty()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsEnum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  priority?: string;
}

class PublicAddCommentDto {
  @ApiProperty()
  @IsString()
  comment: string;
}

@ApiTags('Public Complaints')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('complaints/public')
export class PublicComplaintsController {
  constructor(private complaintsService: ComplaintsService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user complaints' })
  findMine(@Req() req: any) {
    const user = req.user;
    return this.complaintsService.findByComplainantId(user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single complaint by ID (own complaints only)' })
  findOne(@Param('id') id: string, @Req() req: any) {
    const user = req.user;
    return this.complaintsService.findByIdPublic(id, user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Submit a complaint (any authenticated user)' })
  create(@Body() body: PublicCreateComplaintDto, @Req() req: any) {
    const user = req.user;
    return this.complaintsService.create({
      complainantId: user.sub,
      complainantRole: user.role,
      againstUserId: body.againstUserId,
      tripId: body.tripId,
      type: body.type,
      subject: body.subject,
      description: body.description,
      priority: body.priority || 'MEDIUM',
    });
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to own complaint' })
  addComment(
    @Param('id') id: string,
    @Body() body: PublicAddCommentDto,
    @Req() req: any,
  ) {
    const user = req.user;
    return this.complaintsService.addComment(
      id,
      user.sub,
      user.role,
      body.comment,
      false,
    );
  }
}
