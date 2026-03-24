import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { ComplaintsService } from './complaints.service';
import { AdminGuard } from '../auth/admin.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { CreateComplaintDto } from './dto/create-complaint.dto';
import { UpdateComplaintStatusDto } from './dto/update-complaint-status.dto';
import { AddComplaintCommentDto } from './dto/add-comment.dto';

@ApiTags('Complaints')
@ApiBearerAuth()
@UseGuards(AdminGuard, RolesGuard)
@Controller('complaints')
export class ComplaintsController {
  constructor(private complaintsService: ComplaintsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all complaints' })
  @ApiQuery({ name: 'status', required: false, type: String })
  findAll(@Query('status') status?: string) {
    return this.complaintsService.findAll(status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get complaint by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.complaintsService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new complaint' })
  create(@Body() body: CreateComplaintDto) {
    return this.complaintsService.create(body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update complaint status' })
  @ApiParam({ name: 'id', type: String })
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateComplaintStatusDto,
  ) {
    return this.complaintsService.updateStatus(id, body.status, body.assignedTo, body.resolution);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Add a comment to a complaint' })
  @ApiParam({ name: 'id', type: String })
  addComment(
    @Param('id') id: string,
    @Body() body: AddComplaintCommentDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.complaintsService.addComment(id, user.sub, user.role.toString(), body.comment, body.isInternal);
  }
}
