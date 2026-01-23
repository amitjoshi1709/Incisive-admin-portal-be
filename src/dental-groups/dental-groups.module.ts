import { Module } from '@nestjs/common';
import { DentalGroupsController } from './dental-groups.controller';
import { DentalGroupsService } from './dental-groups.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [DentalGroupsController],
  providers: [DentalGroupsService],
  exports: [DentalGroupsService],
})
export class DentalGroupsModule {}
