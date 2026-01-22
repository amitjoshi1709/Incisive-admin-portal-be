import { Module } from '@nestjs/common';
import { PracticesController } from './practices.controller';
import { PracticesService } from './practices.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [PracticesController],
  providers: [PracticesService],
  exports: [PracticesService],
})
export class PracticesModule {}
