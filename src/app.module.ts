import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

// Config
import { appConfig, databaseConfig, jwtConfig } from './config';

// Modules
import { PrismaModule } from './prisma/prisma.module';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { HealthModule } from './health/health.module';
import { TablesModule } from './tables/tables.module';
import { LabsModule } from './labs/labs.module';
import { PracticesModule } from './practices/practices.module';
import { ProductsModule } from './products/products.module';
import { DentalGroupsModule } from './dental-groups/dental-groups.module';

// Guards
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Module({
  imports: [
    // Configuration - load environment variables
    ConfigModule.forRoot({
      isGlobal: true, // Available everywhere
      load: [appConfig, databaseConfig, jwtConfig],
      envFilePath: '.env',
    }),

    // Rate limiting (disabled for development)
    // ThrottlerModule.forRootAsync({
    //   imports: [ConfigModule],
    //   inject: [ConfigService],
    //   useFactory: (config: ConfigService) => ({
    //     throttlers: [
    //       {
    //         ttl: (config.get<number>('app.throttle.ttl') || 60) * 1000,
    //         limit: config.get<number>('app.throttle.limit') || 10,
    //       },
    //     ],
    //   }),
    // }),

    // Core modules
    PrismaModule,
    AdminModule,
    AuthModule,
    UsersModule,
    AuditModule,
    HealthModule,
    TablesModule,
    LabsModule,
    PracticesModule,
    ProductsModule,
    DentalGroupsModule,
  ],
  providers: [
    // Global JWT Auth Guard - all routes require auth by default
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global Rate Limit Guard (disabled for development)
    // {
    //   provide: APP_GUARD,
    //   useClass: ThrottlerGuard,
    // },
  ],
})
export class AppModule {}
