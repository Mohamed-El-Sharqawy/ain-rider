import { Module, Global } from '@nestjs/common';
import { AdminAuditLogger } from './admin-audit-logger.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AdminAuditLogger],
  exports: [AdminAuditLogger],
})
export class AuditModule {}
