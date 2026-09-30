import { Module } from '@nestjs/common';
import { ComplaintsController } from './complaints.controller';
import { PublicComplaintsController } from './public-complaints.controller';
import { ComplaintsService } from './complaints.service';
import { AuthModule } from '../auth/auth.module';
import { NatsModule } from '../shared/nats/nats.module';
import { ComplaintEventPublisher } from '../events/complaint-event.publisher';

@Module({
  imports: [AuthModule, NatsModule],
  controllers: [ComplaintsController, PublicComplaintsController],
  providers: [ComplaintsService, ComplaintEventPublisher],
  exports: [ComplaintsService],
})
export class ComplaintsModule {}
