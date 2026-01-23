import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DentalGroupsService } from './dental-groups.service';

@ApiTags('Dental Groups')
@ApiBearerAuth()
@Controller('dental-groups')
export class DentalGroupsController {
  constructor(private readonly dentalGroupsService: DentalGroupsService) {}

  @Get('ids')
  @ApiOperation({ summary: 'Get all dental group IDs and names' })
  @ApiResponse({
    status: 200,
    description: 'List of dental groups with IDs and names',
    schema: {
      type: 'object',
      properties: {
        dentalGroups: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              dental_group_id: { type: 'number', example: 1 },
              name: { type: 'string', example: 'Dental Group Name' },
            },
          },
        },
      },
    },
  })
  async getDentalGroupIds() {
    return this.dentalGroupsService.getDentalGroupIds();
  }
}
