import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { StorageModule } from '../shared/storage/storage.module';
import { AuthModule } from '../auth/auth.module';
import { AuthDbService } from '../prisma/auth-db.service';

@Module({
  imports: [StorageModule, AuthModule],
  controllers: [ProfileController],
  providers: [ProfileService, AuthDbService],
  exports: [ProfileService],
})
export class ProfileModule {}
