import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsInt, Min, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

export class TableColumnDto {
  @ApiProperty({ description: 'Column key/name' })
  key: string;

  @ApiProperty({ description: 'Display label' })
  label: string;

  @ApiProperty({
    description: 'Column data type',
    enum: ['text', 'email', 'date', 'boolean', 'select', 'number', 'uuid']
  })
  type: 'text' | 'email' | 'date' | 'boolean' | 'select' | 'number' | 'uuid';

  @ApiProperty({ description: 'Is column sortable', default: false })
  sortable: boolean;

  @ApiProperty({ description: 'Is column filterable', default: false })
  filterable: boolean;

  @ApiProperty({ description: 'Is column editable', default: true })
  editable: boolean;

  @ApiProperty({ description: 'Is column required', default: false })
  required: boolean;

  @ApiProperty({
    description: 'Options for select type columns',
    required: false,
    type: [Object]
  })
  options?: { value: string; label: string }[];
}

export class TablePermissionsDto {
  @ApiProperty({ description: 'Can read/view records' })
  read: boolean;

  @ApiProperty({ description: 'Can create records' })
  create: boolean;

  @ApiProperty({ description: 'Can update records' })
  update: boolean;

  @ApiProperty({ description: 'Can delete records' })
  delete: boolean;

  @ApiProperty({ description: 'Available special actions', type: [String] })
  actions: string[];
}

export class TableInfoDto {
  @ApiProperty({ description: 'Table name (database)' })
  name: string;

  @ApiProperty({ description: 'Display label' })
  label: string;

  @ApiProperty({ description: 'Table description', required: false })
  description?: string;

  @ApiProperty({ description: 'Icon name for UI', required: false })
  icon?: string;

  @ApiProperty({ description: 'Total row count' })
  rowCount: number;
}

export class TableConfigDto {
  @ApiProperty({ description: 'Table name' })
  name: string;

  @ApiProperty({ description: 'Display label' })
  label: string;

  @ApiProperty({ description: 'Table columns', type: [TableColumnDto] })
  columns: TableColumnDto[];

  @ApiProperty({ description: 'User permissions for this table', type: TablePermissionsDto })
  permissions: TablePermissionsDto;

  @ApiProperty({ description: 'Default sort configuration' })
  defaultSort: { column: string; direction: 'asc' | 'desc' };

  @ApiProperty({ description: 'Primary key field(s)', type: [String] })
  primaryKey: string[];

  @ApiProperty({ description: 'Whether table has composite primary key' })
  hasCompositePrimaryKey: boolean;
}

export class TablesResponseDto {
  @ApiProperty({ description: 'List of available tables', type: [TableInfoDto] })
  tables: TableInfoDto[];
}

export class TableRowsQueryDto {
  @ApiPropertyOptional({ description: 'Page number', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 10;

  @ApiPropertyOptional({ description: 'Search term' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Sort by column' })
  @IsOptional()
  @IsString()
  sortBy?: string;

  @ApiPropertyOptional({ description: 'Sort direction', enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: 'Filter by column (JSON string)', example: '{"role":"ADMIN"}' })
  @IsOptional()
  @IsString()
  filters?: string;
}

export class TableRowsResponseDto {
  @ApiProperty({ description: 'Table rows data' })
  data: Record<string, any>[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiProperty({ description: 'Applied filters' })
  filtersApplied: Record<string, string>;

  @ApiProperty({ description: 'Current sort' })
  sort: { column: string; direction: 'asc' | 'desc' };
}
