import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TablesService } from './tables.service';
import {
  TablesResponseDto,
  TableConfigDto,
  TableRowsQueryDto,
  TableRowsResponseDto,
} from './dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Tables')
@ApiBearerAuth()
@Controller('tables')
export class TablesController {
  constructor(private readonly tablesService: TablesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all available database tables' })
  @ApiResponse({ status: 200, description: 'List of tables', type: TablesResponseDto })
  async getTables(@CurrentUser('role') userRole: string) {
    return this.tablesService.getTables(userRole);
  }

  @Get(':table')
  @ApiOperation({ summary: 'Get table configuration with columns and permissions' })
  @ApiParam({ name: 'table', description: 'Table name' })
  @ApiResponse({ status: 200, description: 'Table configuration', type: TableConfigDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async getTableConfig(
    @Param('table') tableName: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.tablesService.getTableConfig(tableName, userRole);
  }

  @Get(':table/rows')
  @ApiOperation({ summary: 'Get table rows with pagination, filtering, and sorting' })
  @ApiParam({ name: 'table', description: 'Table name' })
  @ApiResponse({ status: 200, description: 'Table rows', type: TableRowsResponseDto })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async getTableRows(
    @Param('table') tableName: string,
    @Query() query: TableRowsQueryDto,
    @CurrentUser('role') userRole: string,
  ) {
    return this.tablesService.getTableRows(tableName, query, userRole);
  }

  @Get(':table/rows/:id')
  @ApiOperation({ summary: 'Get a single row by ID' })
  @ApiParam({ name: 'table', description: 'Table name' })
  @ApiParam({ name: 'id', description: 'Row ID' })
  @ApiResponse({ status: 200, description: 'Row data' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Row not found' })
  async getTableRow(
    @Param('table') tableName: string,
    @Param('id') id: string,
    @CurrentUser('role') userRole: string,
  ) {
    return this.tablesService.getTableRow(tableName, id, userRole);
  }

  @Post(':table/rows')
  @ApiOperation({ summary: 'Create a new row in the table' })
  @ApiParam({ name: 'table', description: 'Table name' })
  @ApiResponse({ status: 201, description: 'Row created successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Table not found' })
  async createTableRow(
    @Param('table') tableName: string,
    @Body() data: Record<string, any>,
    @CurrentUser('role') userRole: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tablesService.createTableRow(tableName, data, userRole, userId);
  }

  @Patch(':table/rows/:id')
  @ApiOperation({ summary: 'Update a row in the table' })
  @ApiParam({ name: 'table', description: 'Table name' })
  @ApiParam({ name: 'id', description: 'Row ID' })
  @ApiResponse({ status: 200, description: 'Row updated successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Row not found' })
  async updateTableRow(
    @Param('table') tableName: string,
    @Param('id') id: string,
    @Body() data: Record<string, any>,
    @CurrentUser('role') userRole: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tablesService.updateTableRow(tableName, id, data, userRole, userId);
  }

  @Delete(':table/rows/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a row from the table' })
  @ApiParam({ name: 'table', description: 'Table name' })
  @ApiParam({ name: 'id', description: 'Row ID' })
  @ApiResponse({ status: 200, description: 'Row deleted successfully' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 404, description: 'Row not found' })
  async deleteTableRow(
    @Param('table') tableName: string,
    @Param('id') id: string,
    @CurrentUser('role') userRole: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.tablesService.deleteTableRow(tableName, id, userRole, userId);
  }
}
