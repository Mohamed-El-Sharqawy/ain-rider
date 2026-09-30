import { Controller, Get, Patch, Post, Delete, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { AdminGuard } from '../auth/admin.guard';
import { CurrentUser, type CurrentUserPayload } from '../auth/current-user.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { UploadProfileImageDto } from './dto/upload-profile-image.dto';

@ApiTags('Profile')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('profile')
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  getProfile(@CurrentUser() user: CurrentUserPayload) {
    return this.profileService.getProfile(user.sub);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  updateProfile(@CurrentUser() user: CurrentUserPayload, @Body() body: UpdateProfileDto) {
    return this.profileService.updateProfile(user.sub, body);
  }

  @Post('upload-url')
  @ApiOperation({ summary: 'Generate presigned URL for profile image upload' })
  generateUploadUrl(@CurrentUser() user: CurrentUserPayload, @Body() body: UploadProfileImageDto) {
    return this.profileService.generateUploadUrl(user.sub, body.fileName, body.contentType);
  }

  @Delete('image')
  @ApiOperation({ summary: 'Delete profile image' })
  async deleteProfileImage(@CurrentUser() user: CurrentUserPayload) {
    await this.profileService.deleteProfileImage(user.sub);
    return { message: 'Profile image deleted successfully' };
  }
}
