import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiCenterSdkModule } from './api-center/api-center-sdk.module.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { AuthModule } from './auth/auth.module.js';
// Enable strict env validation in production by uncommenting the next line:
// import { validateEnv } from './common/config/env.validation.js';
import { CorrelationIdMiddleware } from './common/middleware/correlation-id.middleware.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';
import { SupabaseModule } from './supabase/supabase.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      cache: true,
      // Uncomment to enable strict env validation (requires all vars in .env.example):
      // validate: validateEnv,
    }),
    DatabaseModule,
    SupabaseModule,
    HealthModule,
    ApiCenterSdkModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
