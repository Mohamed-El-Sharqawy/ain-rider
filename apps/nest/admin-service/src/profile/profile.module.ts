import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { StorageModule } from '../shared/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { InternalApiModule } from '../shared/internal-api/internal-api.module';

@Module({
  imports: [StorageModule, AuthModule, InternalApiModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
