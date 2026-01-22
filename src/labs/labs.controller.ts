import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { LabsService } from './labs.service';

@ApiTags('Labs')
@ApiBearerAuth()
@Controller('labs')
export class LabsController {
  constructor(private readonly labsService: LabsService) {}

  @Get('ids')
  @ApiOperation({ summary: 'Get all lab IDs and names' })
  @ApiResponse({
    status: 200,
    description: 'List of labs with IDs and names',
    schema: {
      type: 'object',
      properties: {
        labs: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              lab_id: { type: 'number', example: 1 },
              lab_name: { type: 'string', example: 'Lab Name' },
            },
          },
        },
      },
    },
  })
  async getLabIds() {
    return this.labsService.getLabIds();
  }
}
