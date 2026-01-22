import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PracticesService } from './practices.service';

@ApiTags('Practices')
@ApiBearerAuth()
@Controller('practices')
export class PracticesController {
  constructor(private readonly practicesService: PracticesService) {}

  @Get('ids')
  @ApiOperation({ summary: 'Get all practice IDs and dental group names' })
  @ApiResponse({
    status: 200,
    description: 'List of practices with IDs and dental group names',
    schema: {
      type: 'object',
      properties: {
        practices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              practice_id: { type: 'number', example: 1 },
              dental_group_name: { type: 'string', example: 'Dental Group Name' },
            },
          },
        },
      },
    },
  })
  async getPracticeIds() {
    return this.practicesService.getPracticeIds();
  }
}
