import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
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

  @Get('search')
  @ApiOperation({ summary: 'Search practices by dental group name' })
  @ApiQuery({ name: 'q', required: true, description: 'Search keyword' })
  @ApiResponse({
    status: 200,
    description: 'List of matching practices with IDs and dental group names',
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
  async searchPractices(@Query('q') query: string) {
    return this.practicesService.searchPractices(query || '');
  }
}
