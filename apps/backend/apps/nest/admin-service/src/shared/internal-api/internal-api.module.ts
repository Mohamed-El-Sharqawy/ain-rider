import { Module, Global } from '@nestjs/common';
import { InternalApiClient } from './internal-api.client';
import { JwtModule } from '@nestjs/jwt';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [InternalApiClient],
  exports: [InternalApiClient],
})
export class InternalApiModule {}
