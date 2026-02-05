import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  TableInfoDto,
  TableConfigDto,
  TableColumnDto,
  TableRowsQueryDto,
} from './dto';
import { AllowedTable, ADMIN_ONLY_TABLES, getAllowedTableNames } from './tables.enum';

@Injectable()
export class TablesService {
  constructor(private prisma: PrismaService) { }

  /**
   * Tables to exclude from the API entirely (e.g., tables with @@ignore)
   * These are excluded even if added to AllowedTable enum
   */
  private readonly EXCLUDED_TABLES = [
    'orders_stage', // Has @@ignore - Prisma can't handle it
  ];

  /**
   * Get all available tables with metadata
   * Only returns tables defined in AllowedTable enum
   */
  async getTables(userRole: string): Promise<{ tables: TableInfoDto[] }> {
    // Get allowed table names from enum
    const allowedTableNames = getAllowedTableNames();

    // Get models that exist in Prisma AND are in the allowed enum
    const allModels = Prisma.dmmf.datamodel.models
      .map((model) => model.name)
      .filter((name) => allowedTableNames.includes(name))
      .filter((name) => !this.EXCLUDED_TABLES.includes(name));

    // Filter tables based on role (use imported ADMIN_ONLY_TABLES)
    const accessibleModels = userRole === 'ADMIN'
      ? allModels
      : allModels.filter((name) => !ADMIN_ONLY_TABLES.includes(name));

    // Get row counts for each table
    const tables: TableInfoDto[] = await Promise.all(
      accessibleModels.map(async (modelName) => {
        const count = await this.getTableRowCount(modelName);
        return {
          name: modelName,
          label: this.formatTableLabel(modelName),
          description: this.getTableDescription(modelName),
          icon: this.getTableIcon(modelName),
          rowCount: count,
        };
      }),
    );

    return { tables };
  }

  /**
   * Get table configuration with columns and permissions
   * Only allows access to tables defined in AllowedTable enum
   */
  async getTableConfig(tableName: string, userRole: string): Promise<TableConfigDto> {
    // Check if table exists
    const model = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.toLowerCase() === tableName.toLowerCase(),
    );

    if (!model) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    // Check if table is in the AllowedTable enum
    const allowedTableNames = getAllowedTableNames();
    if (!allowedTableNames.includes(model.name)) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    // Check if table is excluded
    if (this.EXCLUDED_TABLES.includes(model.name)) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    // Check access permissions (use imported ADMIN_ONLY_TABLES)
    const isAdminOnlyTable = ADMIN_ONLY_TABLES.includes(model.name);
    if (isAdminOnlyTable && userRole !== 'ADMIN') {
      throw new ForbiddenException(`Access denied to table '${tableName}'`);
    }

    // Build columns from Prisma schema
    const columns: TableColumnDto[] = model.fields
      .filter((field) => !field.relationName) // Exclude relation fields
      .map((field) => this.mapFieldToColumn(field, model.name))
      .filter((col) => col !== null); // Remove hidden fields

    // Determine permissions based on role and table
    const permissions = this.getTablePermissions(model.name, userRole);

    // Get primary key info
    const primaryKey = this.getPrimaryKeyFields(model);
    const hasCompositePrimaryKey = primaryKey.length > 1;

    // Get valid default sort column
    const validFields = model.fields
      .filter((f: any) => !f.relationName)
      .map((f: any) => f.name);
    const preferredSortFields = ['created_at', 'updated_at', 'id', ...primaryKey];
    const defaultSortColumn = preferredSortFields.find((f) => validFields.includes(f)) || validFields[0];

    return {
      name: model.name,
      label: this.formatTableLabel(model.name),
      columns,
      permissions,
      defaultSort: { column: defaultSortColumn, direction: 'desc' },
      primaryKey,
      hasCompositePrimaryKey,
    };
  }

  /**
   * Get table rows with pagination, filtering, and sorting
   */
  async getTableRows(
    tableName: string,
    query: TableRowsQueryDto,
    userRole: string,
  ) {
    // Validate table access
    await this.validateTableAccess(tableName, userRole, 'read');

    // Special handling for product_lab_rev_share table
    if (tableName.toLowerCase() === 'product_lab_rev_share') {
      return this.getProductLabRevShareRows(query);
    }

    const { page = 1, limit = 10, search, sortBy, sortOrder = 'desc', filters } = query;
    const skip = (page - 1) * limit;

    // Get the Prisma model delegate
    const modelDelegate = this.getModelDelegate(tableName);
    const model = this.getModelDefinition(tableName);

    // Build where clause
    const where: any = {};

    // Apply search across searchable fields
    if (search) {
      const stringFields = model.fields
        .filter((f: any) => f.type === 'String' && !f.relationName)
        .map((f: any) => f.name);

      const numericFields = model.fields
        .filter((f: any) => (f.type === 'Int' || f.type === 'BigInt') && !f.relationName)
        .map((f: any) => ({ name: f.name, type: f.type }));

      const orConditions: any[] = [];

      // Add string field searches (contains)
      stringFields.forEach((field: string) => {
        orConditions.push({
          [field]: { contains: search, mode: 'insensitive' },
        });
      });

      // Add numeric field searches (exact match if search is a number)
      const searchNum = parseInt(search, 10);
      if (!isNaN(searchNum)) {
        numericFields.forEach((field: { name: string; type: string }) => {
          orConditions.push({
            [field.name]: field.type === 'BigInt' ? BigInt(searchNum) : searchNum,
          });
        });
      }

      if (orConditions.length > 0) {
        where.OR = orConditions;
      }
    }

    // Apply filters
    let parsedFilters: Record<string, any> = {};
    if (filters) {
      try {
        parsedFilters = JSON.parse(filters);
        Object.entries(parsedFilters).forEach(([key, value]) => {
          if (value !== undefined && value !== '') {
            where[key] = value;
          }
        });
      } catch {
        // Invalid JSON, ignore filters
      }
    }

    // Build orderBy - only use columns that exist in the table
    const validFields = model.fields
      .filter((f: any) => !f.relationName)
      .map((f: any) => f.name);

    let orderBy: any = undefined;

    if (sortBy && validFields.includes(sortBy)) {
      // Use provided sortBy if it's a valid field
      orderBy = { [sortBy]: sortOrder };
    } else {
      // Try common sort fields in order of preference
      const preferredSortFields = ['created_at', 'updated_at', 'id'];
      const validSortField = preferredSortFields.find((f) => validFields.includes(f));

      if (validSortField) {
        orderBy = { [validSortField]: sortOrder };
      } else if (validFields.length > 0) {
        // Fallback to first available field
        orderBy = { [validFields[0]]: sortOrder };
      }
    }

    // Get hidden fields to exclude (global + table-specific)
    const globalHiddenFields = ['password', 'refresh_token'];
    const tableHiddenFields: Record<string, string[]> = {
      product_lab_markup: ['incisive_product_id'],
    };
    const hiddenFields = [
      ...globalHiddenFields,
      ...(tableHiddenFields[tableName.toLowerCase()] || []),
    ];
    const selectFields: Record<string, boolean> = {};
    model.fields
      .filter((f: any) => !f.relationName && !hiddenFields.includes(f.name))
      .forEach((f: any) => {
        selectFields[f.name] = true;
      });

    // Execute query
    const [rows, total] = await Promise.all([
      modelDelegate.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        select: selectFields,
      }),
      modelDelegate.count({ where }),
    ]);

    // Get the actual sort column used
    const actualSortColumn = orderBy ? Object.keys(orderBy)[0] : null;

    return {
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filtersApplied: parsedFilters,
      sort: actualSortColumn
        ? { column: actualSortColumn, direction: sortOrder }
        : null,
    };
  }

  /**
   * Get a single row by ID
   * For composite keys, pass JSON: {"field1":"val1","field2":"val2"}
   */
  async getTableRow(tableName: string, id: string, userRole: string) {
    await this.validateTableAccess(tableName, userRole, 'read');

    const modelDelegate = this.getModelDelegate(tableName);
    const model = this.getModelDefinition(tableName);

    // Build where clause (handles composite keys)
    const whereClause = this.buildWhereClause(model, id);

    // Get hidden fields to exclude
    const hiddenFields = ['password', 'refresh_token'];
    const selectFields: Record<string, boolean> = {};
    model.fields
      .filter((f: any) => !f.relationName && !hiddenFields.includes(f.name))
      .forEach((f: any) => {
        selectFields[f.name] = true;
      });

    const row = await modelDelegate.findUnique({
      where: whereClause,
      select: selectFields,
    });

    if (!row) {
      throw new NotFoundException(`Record not found in ${tableName}`);
    }

    return row;
  }

  /**
   * Create a new row in the table
   */
  async createTableRow(
    tableName: string,
    data: Record<string, any>,
    userRole: string,
    userId: string,
  ) {
    await this.validateTableAccess(tableName, userRole, 'create');

    const modelDelegate = this.getModelDelegate(tableName);
    const model = this.getModelDefinition(tableName);

    // Special handling for product_lab_rev_share table
    if (tableName.toLowerCase() === 'product_lab_rev_share') {
      return await this.createProductLabRevShareRows(data, userId);
    }

    // Convert field types to match Prisma schema
    data = this.convertFieldTypes(model, data);

    // Hash password if creating a user
    if (tableName === 'users' && data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    try {
      const row = await modelDelegate.create({
        data,
      });

      // Log the action
      const pkFields = this.getPrimaryKeyFields(model);
      const resourceId = pkFields.length === 1 ? row[pkFields[0]] : JSON.stringify(
        pkFields.reduce((acc, pk) => ({ ...acc, [pk]: row[pk] }), {})
      );

      // await this.auditService.log({
      //   userId,
      //   action: AuditAction.CREATE_RECORD,
      //   resource: String(resourceId),
      //   details: { table: tableName },
      // });

      // Add id field for frontend consistency
      return { ...row, id: resourceId };
    } catch (error: any) {
      // Debug: Log the actual error
      console.error('[CREATE] Error code:', error.code);
      console.error('[CREATE] Error message:', error.message);
      console.error('[CREATE] Error meta:', error.meta);

      // Handle unique constraint violation
      if (error.code === 'P2002') {
        const fields = error.meta?.target || [];
        const fieldNames = fields.join(', ');
        const fieldValues = fields.map((f: string) => data[f]).join(', ');
        throw new ConflictException(
          `${fieldValues} for ${fieldNames} already exists`
        );
      }
      // Handle foreign key constraint violation
      if (error.code === 'P2003' || error.message?.includes('Foreign key constraint')) {
        // Get constraint name from meta or message
        let constraintName = error.meta?.field_name;

        if (!constraintName) {
          const fieldMatch = error.message?.match(/`([^`]+)`\s*\(index\)/);
          constraintName = fieldMatch ? fieldMatch[1] : null;
        }

        // Clean up constraint name - remove "(index)" suffix if present
        constraintName = constraintName?.replace(/\s*\(index\)$/i, '');

        // Extract field name from constraint (e.g., lab_product_mapping_incisive_product_id_fkey -> incisive_product_id)
        let fieldName = 'foreign key';
        if (constraintName) {
          const fkeyMatch = constraintName.match(/_([a-z_]+_id)_fkey$/i);
          fieldName = fkeyMatch ? fkeyMatch[1] : constraintName;
        }

        throw new BadRequestException(
          `Invalid value for '${fieldName}'. The referenced record does not exist.`
        );
      }
      // Handle check constraint violation (PostgreSQL code 23514)
      if (error.message?.includes('check constraint')) {
        const constraintMatch = error.message.match(/violates check constraint "([^"]+)"/);
        const constraintName = constraintMatch ? constraintMatch[1] : 'unknown';
        // Extract field name from constraint name (e.g., labs_partner_model_check -> partner_model)
        const fieldMatch = constraintName.match(/^[^_]+_(.+)_check$/);
        const fieldName = fieldMatch ? fieldMatch[1] : constraintName;
        throw new BadRequestException(
          `Invalid value for '${fieldName}'. Please check allowed values.`
        );
      }
      // Handle validation errors
      if (error.name === 'PrismaClientValidationError') {
        const message = error.message;
        const lastLine = message.split('\n').filter((line: string) => line.trim()).pop() || 'Invalid data provided';
        throw new BadRequestException(lastLine.trim());
      }
      throw error;
    }
  }

  /**
   * Special create handler for product_lab_rev_share - creates records for all fee schedules
   */
  private async createProductLabRevShareRows(
    data: Record<string, any>,
    userId: string,
  ) {
    const { lab_id, lab_product_id } = data;

    if (!lab_id || lab_product_id === undefined) {
      throw new BadRequestException('lab_id and lab_product_id are required');
    }

    // Get all fee schedule names
    const feeSchedules = await this.prisma.fee_schedules.findMany({
      select: { schedule_name: true },
    });

    if (feeSchedules.length === 0) {
      throw new BadRequestException('No fee schedules found');
    }

    // Create records for each fee schedule
    const records = feeSchedules.map((fs) => ({
      lab_id: BigInt(lab_id),
      lab_product_id: String(lab_product_id),
      fee_schedule_name: fs.schedule_name,
    }));

    // Check if records already exist
    const existing = await this.prisma.product_lab_rev_share.findFirst({
      where: {
        lab_id: BigInt(lab_id),
        lab_product_id: String(lab_product_id),
      },
    });

    if (existing) {
      throw new ConflictException(
        `Records for lab_id ${lab_id} and lab_product_id ${lab_product_id} already exist`
      );
    }

    const result = await this.prisma.product_lab_rev_share.createMany({
      data: records,
      skipDuplicates: true,
    });

    return { message: 'Records created successfully', count: result.count };
  }

  /**
   * Special get handler for product_lab_rev_share - cross join with fee_schedules
   */
  private async getProductLabRevShareRows(query: TableRowsQueryDto) {
    const { page = 1, limit = 10, filters, search } = query;
    const offset = (page - 1) * limit;

    // Parse filters for lab_id and lab_product_id
    let labIdFilter: bigint | null = null;
    let labProductIdFilter: string | null = null;
    if (filters) {
      try {
        const parsedFilters = JSON.parse(filters);
        if (parsedFilters.lab_id) {
          labIdFilter = BigInt(parsedFilters.lab_id);
        }
        if (parsedFilters.lab_product_id) {
          labProductIdFilter = decodeURIComponent(String(parsedFilters.lab_product_id));
        }
      } catch {
        // Invalid JSON, ignore filters
      }
    }

    // Search term for lab_product_id (string contains) or lab_id (exact match if numeric)
    const searchTerm = search ? `%${search}%` : null;
    // Only convert to BigInt if search is a valid integer (no decimals, no whitespace)
    const trimmedSearch = search?.trim();
    const isValidInteger = trimmedSearch && /^-?\d+$/.test(trimmedSearch);
    const searchLabId = isValidInteger ? BigInt(trimmedSearch) : null;

    // Get total count (count of unique lab_id, lab_product_id combinations)
    const countResult = await this.prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM (
        SELECT DISTINCT lab_id, lab_product_id
        FROM product_lab_rev_share
        WHERE (${labIdFilter}::BIGINT IS NULL OR lab_id = ${labIdFilter})
          AND (${labProductIdFilter}::TEXT IS NULL OR lab_product_id = ${labProductIdFilter})
          AND (
            ${searchTerm}::TEXT IS NULL
            OR lab_product_id ILIKE ${searchTerm}
            OR (${searchLabId}::BIGINT IS NOT NULL AND lab_id = ${searchLabId})
          )
      ) AS total
    `;
    const total = Number(countResult[0].count);

    // Get paginated data with schedule_name aggregated as JSON
    const result = await this.prisma.$queryRaw<
      {
        lab_id: bigint;
        lab_product_id: string;
        schedule_name: Record<string, number | null>;
      }[]
    >`
      SELECT *
      FROM (
        SELECT
          pl.lab_id,
          pl.lab_product_id,
          jsonb_object_agg(
            fs.schedule_name,
            plrs.revenue_share
            ORDER BY fs.schedule_name
          ) AS schedule_name
        FROM (
          SELECT DISTINCT lab_id, lab_product_id
          FROM product_lab_rev_share
          WHERE (${labIdFilter}::BIGINT IS NULL OR lab_id = ${labIdFilter})
            AND (${labProductIdFilter}::TEXT IS NULL OR lab_product_id = ${labProductIdFilter})
            AND (
              ${searchTerm}::TEXT IS NULL
              OR lab_product_id ILIKE ${searchTerm}
              OR (${searchLabId}::BIGINT IS NOT NULL AND lab_id = ${searchLabId})
            )
        ) pl
        CROSS JOIN fee_schedules fs
        LEFT JOIN product_lab_rev_share plrs
          ON plrs.lab_id = pl.lab_id
         AND plrs.lab_product_id = pl.lab_product_id
         AND plrs.fee_schedule_name = fs.schedule_name
        GROUP BY
          pl.lab_id,
          pl.lab_product_id
      ) grouped_products
      ORDER BY lab_product_id
      LIMIT ${limit} OFFSET ${offset}
    `;

    // Build filtersApplied response
    const filtersApplied: Record<string, string> = {};
    if (labIdFilter) filtersApplied.lab_id = String(labIdFilter);
    if (labProductIdFilter) filtersApplied.lab_product_id = labProductIdFilter;

    return {
      data: result.map((row) => ({
        lab_id: Number(row.lab_id),
        lab_product_id: row.lab_product_id,
        schedule_name: row.schedule_name,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      filtersApplied,
      searchApplied: search || null,
      sort: { column: 'lab_product_id', direction: 'asc' },
    };
  }

  /**
   * Update product_lab_markup row
   */
  async updateProductLabMarkupRow(
    data: {
      lab_id: number;
      lab_product_id: string;
      cost?: number;
      standard_price?: number;
      nf_price?: number;
      commitment_eligible?: boolean;
    },
    userId: string,
  ): Promise<{ data: Record<string, any>[] }> {
    const { lab_id, lab_product_id, cost, standard_price, nf_price, commitment_eligible } = data;

    // Build update data with proper type conversions
    const updateData: Record<string, any> = {};
    if (cost !== undefined) {
      updateData.cost = cost === null ? null : parseFloat(String(cost));
    }
    if (standard_price !== undefined) {
      updateData.standard_price = standard_price === null ? null : parseFloat(String(standard_price));
    }
    if (nf_price !== undefined) {
      updateData.nf_price = nf_price === null ? null : parseFloat(String(nf_price));
    }
    if (commitment_eligible !== undefined) {
      updateData.commitment_eligible = commitment_eligible === true || (commitment_eligible as any) === 'true';
    }

    const result = await this.prisma.product_lab_markup.updateMany({
      where: {
        lab_id: BigInt(lab_id),
        lab_product_id: String(lab_product_id),
      },
      data: updateData,
    });

    if (result.count === 0) {
      throw new NotFoundException('Record not found in product_lab_markup');
    }

    // Log the action
    // await this.auditService.log({
    //   userId,
    //   action: AuditAction.UPDATE_RECORD,
    //   resource: `${lab_id}-${lab_product_id}`,
    //   details: { table: 'product_lab_markup', ...updateData },
    // });

    // Fetch and return updated record
    const updatedRecord = await this.prisma.product_lab_markup.findFirst({
      where: {
        lab_id: BigInt(lab_id),
        lab_product_id: String(lab_product_id),
      },
      select: {
        lab_id: true,
        lab_product_id: true,
        cost: true,
        standard_price: true,
        nf_price: true,
        commitment_eligible: true,
      },
    });

    return {
      data: updatedRecord ? [{
        lab_id: Number(updatedRecord.lab_id),
        lab_product_id: updatedRecord.lab_product_id,
        cost: updatedRecord.cost ? Number(updatedRecord.cost) : null,
        standard_price: updatedRecord.standard_price ? Number(updatedRecord.standard_price) : null,
        nf_price: updatedRecord.nf_price ? Number(updatedRecord.nf_price) : null,
        commitment_eligible: updatedRecord.commitment_eligible,
      }] : [],
    };
  }

  /**
   * Delete product_lab_markup row by lab_id and lab_product_id
   */
  async deleteProductLabMarkupRow(
    data: {
      lab_id: number;
      lab_product_id: string;
    },
    userId: string,
  ): Promise<{ message: string }> {
    const { lab_id, lab_product_id } = data;

    // Validate required fields
    if (!lab_id) {
      throw new BadRequestException('lab_id is required');
    }
    if (!lab_product_id || lab_product_id.trim() === '') {
      throw new BadRequestException('lab_product_id is required');
    }

    // Delete record matching lab_id and lab_product_id
    const result = await this.prisma.product_lab_markup.deleteMany({
      where: {
        lab_id: BigInt(lab_id),
        lab_product_id: String(lab_product_id),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Record not found in product_lab_markup');
    }

    // Log the action
    // await this.auditService.log({
    //   userId,
    //   action: AuditAction.DELETE_RECORD,
    //   resource: `${lab_id}-${lab_product_id}`,
    //   details: { table: 'product_lab_markup' },
    // });

    return { message: 'Record deleted successfully' };
  }

  /**
   * Update product_lab_rev_share row(s)
   * schedule_name can be:
   * - string: single schedule name with revenue_share value
   * - object: { "Schedule A": 0.15, "Schedule B": 0.20, ... } for bulk update
   */
  async updateProductLabRevShareRow(
    data: {
      lab_id: number;
      lab_product_id: string;
      incisive_product_id?: number | null;
      schedule_name: string | Record<string, number | null>;
      revenue_share?: number;
    },
    userId: string,
  ): Promise<{ data: { lab_id: number; lab_product_id: string; schedule_name: Record<string, number | null> }[] }> {
    const { lab_id, lab_product_id, schedule_name, revenue_share, incisive_product_id } = data;

    // Validate required fields
    if (!lab_id) {
      throw new BadRequestException('lab_id is required');
    }
    if (!lab_product_id || lab_product_id.trim() === '') {
      throw new BadRequestException('lab_product_id is required');
    }
    if (!schedule_name) {
      throw new BadRequestException('schedule_name is required');
    }

    // Check if schedule_name is an object (bulk update) or string (single update)
    if (typeof schedule_name === 'object') {
      // Bulk update: schedule_name is { "Schedule A": 0.15, "Schedule B": 0.20, ... }
      const schedules = Object.entries(schedule_name);

      if (schedules.length === 0) {
        throw new BadRequestException('schedule_name object cannot be empty');
      }

      // Build upsert operations for each schedule
      const upsertPromises = schedules.map(([scheduleName, revenueShareValue]) => {
        const updateData: Record<string, any> = {
          revenue_share: revenueShareValue === null ? null : parseFloat(String(revenueShareValue)),
        };
        if (incisive_product_id !== undefined) {
          updateData.incisive_product_id = incisive_product_id === null ? null : parseInt(String(incisive_product_id), 10);
        }

        return this.prisma.product_lab_rev_share.upsert({
          where: {
            lab_id_lab_product_id_fee_schedule_name: {
              lab_id: BigInt(lab_id),
              lab_product_id: String(lab_product_id),
              fee_schedule_name: scheduleName,
            },
          },
          update: updateData,
          create: {
            lab_id: BigInt(lab_id),
            lab_product_id: String(lab_product_id),
            fee_schedule_name: scheduleName,
            ...updateData,
          },
        });
      });

      await Promise.all(upsertPromises);

      // Log the action
      // await this.auditService.log({
      //   userId,
      //   action: AuditAction.UPDATE_RECORD,
      //   resource: `${lab_id}-${lab_product_id}`,
      //   details: { table: 'product_lab_rev_share', schedulesUpdated: schedules.length },
      // });
    } else {
      // Single update: schedule_name is a string
      if (schedule_name.trim() === '') {
        throw new BadRequestException('schedule_name is required');
      }

      // Build update/create data
      const updateData: Record<string, any> = {};
      if (revenue_share !== undefined) {
        updateData.revenue_share = revenue_share === null ? null : parseFloat(String(revenue_share));
      }
      if (incisive_product_id !== undefined) {
        updateData.incisive_product_id = incisive_product_id === null ? null : parseInt(String(incisive_product_id), 10);
      }

      // Upsert: update if exists, create if not
      await this.prisma.product_lab_rev_share.upsert({
        where: {
          lab_id_lab_product_id_fee_schedule_name: {
            lab_id: BigInt(lab_id),
            lab_product_id: String(lab_product_id),
            fee_schedule_name: schedule_name,
          },
        },
        update: updateData,
        create: {
          lab_id: BigInt(lab_id),
          lab_product_id: String(lab_product_id),
          fee_schedule_name: schedule_name,
          ...updateData,
        },
      });

      // Log the action
      // await this.auditService.log({
      //   userId,
      //   action: AuditAction.UPDATE_RECORD,
      //   resource: `${lab_id}-${lab_product_id}-${schedule_name}`,
      //   details: { table: 'product_lab_rev_share' },
      // });
    }

    // Fetch and return updated data using helper method
    return this.fetchProductLabRevShareData(BigInt(lab_id), String(lab_product_id));
  }

  /**
   * Helper method to fetch product_lab_rev_share data with aggregated schedule_name
   */
  private async fetchProductLabRevShareData(
    labId: bigint,
    labProductId: string,
  ): Promise<{ data: { lab_id: number; lab_product_id: string; schedule_name: Record<string, number | null> }[] }> {
    const result = await this.prisma.$queryRaw<
      {
        lab_id: bigint;
        lab_product_id: string;
        schedule_name: Record<string, number | null>;
      }[]
    >`
      SELECT
        pl.lab_id,
        pl.lab_product_id,
        jsonb_object_agg(
          fs.schedule_name,
          plrs.revenue_share
          ORDER BY fs.schedule_name
        ) AS schedule_name
      FROM (
        SELECT DISTINCT lab_id, lab_product_id
        FROM product_lab_rev_share
        WHERE lab_id = ${labId} AND lab_product_id = ${labProductId}
      ) pl
      CROSS JOIN fee_schedules fs
      LEFT JOIN product_lab_rev_share plrs
        ON plrs.lab_id = pl.lab_id
       AND plrs.lab_product_id = pl.lab_product_id
       AND plrs.fee_schedule_name = fs.schedule_name
      GROUP BY pl.lab_id, pl.lab_product_id
    `;

    return {
      data: result.map((row) => ({
        lab_id: Number(row.lab_id),
        lab_product_id: row.lab_product_id,
        schedule_name: row.schedule_name,
      })),
    };
  }

  /**
   * Delete product_lab_rev_share rows by lab_id and lab_product_id
   */
  async deleteProductLabRevShareRows(
    data: {
      lab_id: number;
      lab_product_id: string;
    },
    userId: string,
  ): Promise<{ message: string; count: number }> {
    const { lab_id, lab_product_id } = data;

    // Validate required fields
    if (!lab_id) {
      throw new BadRequestException('lab_id is required');
    }
    if (!lab_product_id || lab_product_id.trim() === '') {
      throw new BadRequestException('lab_product_id is required');
    }

    // Delete all records matching lab_id and lab_product_id
    const result = await this.prisma.product_lab_rev_share.deleteMany({
      where: {
        lab_id: BigInt(lab_id),
        lab_product_id: String(lab_product_id),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('No records found to delete');
    }

    // Log the action
    // await this.auditService.log({
    //   userId,
    //   action: AuditAction.DELETE_RECORD,
    //   resource: `${lab_id}-${lab_product_id}`,
    //   details: { table: 'product_lab_rev_share', count: result.count },
    // });

    return { message: 'Records deleted successfully', count: result.count };
  }

  /**
   * Update a row in the table
   */
  async updateTableRow(
    tableName: string,
    id: string,
    data: Record<string, any>,
    userRole: string,
    userId: string,
  ) {
    await this.validateTableAccess(tableName, userRole, 'update');

    const modelDelegate = this.getModelDelegate(tableName);
    const model = this.getModelDefinition(tableName);

    // Build where clause (handles composite keys)
    const whereClause = this.buildWhereClause(model, id);

    // Get primary key fields
    const pkFields = this.getPrimaryKeyFields(model);

    // Validate: if payload contains primary key, it must match URL ID
    if (pkFields.length === 1) {
      const pkField = pkFields[0];
      if (data[pkField] !== undefined) {
        const payloadPkValue = String(data[pkField]);
        if (payloadPkValue !== id) {
          throw new BadRequestException(
            `Primary key '${pkField}' in payload (${payloadPkValue}) does not match URL ID (${id}). Primary keys cannot be changed.`
          );
        }
      }
    } else if (pkFields.length > 1) {
      // For composite keys, check each field
      for (const pkField of pkFields) {
        if (data[pkField] !== undefined) {
          const payloadPkValue = String(data[pkField]);
          // Parse the URL ID as JSON for composite keys
          try {
            const urlId = JSON.parse(id);
            if (urlId[pkField] !== undefined && payloadPkValue !== String(urlId[pkField])) {
              throw new BadRequestException(
                `Primary key '${pkField}' in payload (${payloadPkValue}) does not match URL ID (${urlId[pkField]}). Primary keys cannot be changed.`
              );
            }
          } catch {
            // If URL ID is not JSON, skip composite key validation
          }
        }
      }
    }

    // Check if record exists
    const existing = await modelDelegate.findUnique({ where: whereClause });
    if (!existing) {
      throw new NotFoundException(`Record with ID '${id}' not found in ${tableName}`);
    }

    // Convert field types to match Prisma schema
    data = this.convertFieldTypes(model, data);

    // Hash password if updating a user's password
    if (tableName === 'users' && data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    // Remove non-editable fields (including all primary key fields)
    const attemptedPkUpdates = pkFields.filter((pk) => data[pk] !== undefined);
    pkFields.forEach((pk) => delete data[pk]);
    delete data.created_at;

    // Auto-update updated_at if the field exists in the model
    const hasUpdatedAt = model.fields.some((f: any) => f.name === 'updated_at');
    if (hasUpdatedAt) {
      data.updated_at = new Date();
    }

    // Check if there's anything left to update
    if (Object.keys(data).length === 0) {
      if (attemptedPkUpdates.length > 0) {
        throw new BadRequestException(
          `Cannot update primary key field(s): ${attemptedPkUpdates.join(', ')}. Primary keys are immutable.`
        );
      }
      throw new BadRequestException('No valid fields to update');
    }

    try {
      const row = await modelDelegate.update({
        where: whereClause,
        data,
      });

      // Log the action
      // await this.auditService.log({
      //   userId,
      //   action: AuditAction.UPDATE_RECORD,
      //   resource: id,
      //   details: { table: tableName },
      // });

      return row;
    } catch (error: any) {
      // Handle unique constraint violation
      if (error.code === 'P2002') {
        const fields = error.meta?.target || [];
        const fieldNames = fields.join(', ');
        const fieldValues = fields.map((f: string) => data[f]).join(', ');
        throw new ConflictException(
          `${fieldValues} for ${fieldNames} already exists`
        );
      }
      // Handle foreign key constraint violation
      if (error.code === 'P2003' || error.message?.includes('Foreign key constraint')) {
        // Get constraint name from meta or message
        let constraintName = error.meta?.field_name;

        if (!constraintName) {
          const fieldMatch = error.message?.match(/`([^`]+)`\s*\(index\)/);
          constraintName = fieldMatch ? fieldMatch[1] : null;
        }

        // Clean up constraint name - remove "(index)" suffix if present
        constraintName = constraintName?.replace(/\s*\(index\)$/i, '');

        // Extract field name from constraint (e.g., lab_product_mapping_incisive_product_id_fkey -> incisive_product_id)
        let fieldName = 'foreign key';
        if (constraintName) {
          const fkeyMatch = constraintName.match(/_([a-z_]+_id)_fkey$/i);
          fieldName = fkeyMatch ? fkeyMatch[1] : constraintName;
        }

        throw new BadRequestException(
          `Invalid value for '${fieldName}'. The referenced record does not exist.`
        );
      }
      // Handle check constraint violation (PostgreSQL code 23514)
      if (error.message?.includes('check constraint')) {
        const constraintMatch = error.message.match(/violates check constraint "([^"]+)"/);
        const constraintName = constraintMatch ? constraintMatch[1] : 'unknown';
        // Extract field name from constraint name (e.g., labs_partner_model_check -> partner_model)
        const fieldMatch = constraintName.match(/^[^_]+_(.+)_check$/);
        const fieldName = fieldMatch ? fieldMatch[1] : constraintName;
        throw new BadRequestException(
          `Invalid value for '${fieldName}'. Please check allowed values.`
        );
      }
      // Handle validation errors
      if (error.name === 'PrismaClientValidationError') {
        const message = error.message;
        const lastLine = message.split('\n').filter((line: string) => line.trim()).pop() || 'Invalid data provided';
        throw new BadRequestException(lastLine.trim());
      }
      throw error;
    }
  }

  /**
   * Delete a row from the table
   */
  async deleteTableRow(
    tableName: string,
    id: string,
    userRole: string,
    userId: string,
  ) {
    await this.validateTableAccess(tableName, userRole, 'delete');

    // Prevent deleting own account
    if (tableName === 'users' && id === userId) {
      throw new ForbiddenException('Cannot delete your own account');
    }

    const modelDelegate = this.getModelDelegate(tableName);
    const model = this.getModelDefinition(tableName);

    // Build where clause (handles composite keys)
    const whereClause = this.buildWhereClause(model, id);

    // Check if record exists
    const existing = await modelDelegate.findUnique({ where: whereClause });
    if (!existing) {
      throw new NotFoundException(`Record not found in ${tableName}`);
    }

    try {
      await modelDelegate.delete({ where: whereClause });

      // Log the action
      // await this.auditService.log({
      //   userId,
      //   action: AuditAction.DELETE_RECORD,
      //   resource: id,
      //   details: { table: tableName },
      // });

      return { message: 'Record deleted successfully' };
    } catch (error: any) {
      // Handle foreign key constraint violation
      if (error.code === 'P2003' || error.message?.includes('Foreign key constraint')) {
        const fieldMatch = error.message?.match(/`([^`]+)`\s*\(index\)/);
        const constraintName = fieldMatch ? fieldMatch[1] : error.meta?.field_name;
        // Extract related table name from constraint (e.g., product_lab_rev_share_fee_schedule_name_fkey)
        const tableMatch = constraintName?.match(/^([^_]+(?:_[^_]+)*?)_[^_]+_fkey$/);
        const relatedTable = tableMatch ? tableMatch[1] : 'other records';
        throw new BadRequestException(
          `Cannot delete this record. It is referenced by ${relatedTable}.`
        );
      }
      throw error;
    }
  }

  // ==================== PRIVATE HELPER METHODS ====================

  /**
   * Get row count for a table
   */
  private async getTableRowCount(tableName: string): Promise<number> {
    try {
      const modelDelegate = (this.prisma as any)[tableName];
      if (modelDelegate && typeof modelDelegate.count === 'function') {
        return await modelDelegate.count();
      }
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Format table name to display label
   */
  private formatTableLabel(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  /**
   * Get table description
   */
  private getTableDescription(name: string): string {
    const descriptions: Record<string, string> = {
      users: 'Manage system users and their roles',
    };
    return descriptions[name] || `Manage ${this.formatTableLabel(name)}`;
  }

  /**
   * Get table icon
   */
  private getTableIcon(name: string): string {
    const icons: Record<string, string> = {
      users: 'users',
    };
    return icons[name] || 'database';
  }

  /**
   * Map Prisma field to column DTO
   */
  private mapFieldToColumn(field: any, tableName: string): TableColumnDto {
    const nonEditableFields = ['id', 'created_at', 'updated_at', 'password', 'refresh_token'];
    const hiddenFields = ['password', 'refresh_token'];

    // Skip hidden fields
    if (hiddenFields.includes(field.name)) {
      return null as any;
    }

    return {
      key: field.name,
      label: this.formatTableLabel(field.name),
      type: this.mapPrismaType(field.type, field.name),
      sortable: ['created_at', 'updated_at', 'email', 'id'].includes(field.name),
      filterable: ['email', 'role', 'is_active', 'action'].includes(field.name),
      editable: !nonEditableFields.includes(field.name),
      required: field.isRequired && !field.hasDefaultValue && field.name !== 'id',
      options: this.getFieldOptions(field.name, tableName),
    };
  }

  /**
   * Map Prisma type to column type
   */
  private mapPrismaType(
    prismaType: string,
    fieldName: string,
  ): 'text' | 'email' | 'date' | 'boolean' | 'select' | 'number' | 'uuid' {
    if (fieldName === 'email') return 'email';
    if (fieldName === 'id') return 'uuid';
    if (fieldName === 'role' || fieldName === 'action') return 'select';
    // These fields use external APIs for options (/labs/ids, /practices/ids, /products/ids)
    // Frontend should fetch options separately
    // if (fieldName === 'lab_id' || fieldName === 'practice_id' || fieldName === 'incisive_product_id') return 'select';

    const typeMap: Record<string, any> = {
      String: 'text',
      Int: 'number',
      BigInt: 'number',
      Float: 'number',
      Decimal: 'number',
      Boolean: 'boolean',
      DateTime: 'date',
      Json: 'text',
    };
    return typeMap[prismaType] || 'text';
  }

  /**
   * Get options for select fields
   */
  private getFieldOptions(
    fieldName: string,
    tableName: string,
  ): { value: string; label: string }[] | undefined {
    if (fieldName === 'role' && tableName === 'users') {
      return [
        { value: 'USER', label: 'User' },
        { value: 'ADMIN', label: 'Admin' },
        { value: 'VIEWER', label: 'Viewer' },
      ];
    }
    return undefined;
  }

  /**
   * Get permissions for a table based on user role
   */
  private getTablePermissions(
    tableName: string,
    userRole: string,
  ): { read: boolean; create: boolean; update: boolean; delete: boolean; actions: string[] } {
    // Admin has full access
    if (userRole === 'ADMIN') {
      const actions = tableName === 'users' ? ['activate', 'deactivate'] : [];
      return {
        read: true,
        create: true,
        update: true,
        delete: true,
        actions,
      };
    }

    // USER role - can read, create, update, and delete
    if (userRole === 'USER') {
      return {
        read: true,
        create: true,
        update: true,
        delete: true,
        actions: [],
      };
    }

    // VIEWER role - read only
    return {
      read: true,
      create: false,
      update: false,
      delete: false,
      actions: [],
    };
  }

  /**
   * Validate table access based on user role
   * Only allows access to tables defined in AllowedTable enum
   */
  private async validateTableAccess(
    tableName: string,
    userRole: string,
    action: 'read' | 'create' | 'update' | 'delete',
  ) {
    const model = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.toLowerCase() === tableName.toLowerCase(),
    );

    if (!model) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    // Check if table is in the AllowedTable enum
    const allowedTableNames = getAllowedTableNames();
    if (!allowedTableNames.includes(model.name)) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    if (this.EXCLUDED_TABLES.includes(model.name)) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    const isAdminOnlyTable = ADMIN_ONLY_TABLES.includes(model.name);
    if (isAdminOnlyTable && userRole !== 'ADMIN') {
      throw new ForbiddenException(`Access denied to table '${tableName}'`);
    }

    // VIEWER role can only read
    if (action !== 'read' && userRole === 'VIEWER') {
      throw new ForbiddenException(`You don't have permission to ${action} in this table`);
    }

    return model.name;
  }

  /**
   * Get Prisma model delegate by table name
   */
  private getModelDelegate(tableName: string): any {
    const model = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.toLowerCase() === tableName.toLowerCase(),
    );

    if (!model) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    const delegate = (this.prisma as any)[model.name];
    if (!delegate) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    return delegate;
  }

  /**
   * Get Prisma model definition
   */
  private getModelDefinition(tableName: string): any {
    const model = Prisma.dmmf.datamodel.models.find(
      (m) => m.name.toLowerCase() === tableName.toLowerCase(),
    );

    if (!model) {
      throw new NotFoundException(`Table '${tableName}' not found`);
    }

    return model;
  }

  /**
   * Get primary key field names for a model
   */
  private getPrimaryKeyFields(model: any): string[] {
    // Check for composite primary key (@@id)
    if (model.primaryKey) {
      return model.primaryKey.fields;
    }

    // Check for single @id field
    const idField = model.fields.find((f: any) => f.isId);
    if (idField) {
      return [idField.name];
    }

    // Fallback to 'id' if exists
    const hasIdField = model.fields.some((f: any) => f.name === 'id');
    if (hasIdField) {
      return ['id'];
    }

    return [];
  }

  /**
   * Build where clause for finding a record by its primary key
   * For composite keys, id should be JSON string like: {"caseid":123,"productid":"ABC"}
   * For single keys, id is the value directly
   */
  private buildWhereClause(model: any, id: string): Record<string, any> {
    const pkFields = this.getPrimaryKeyFields(model);

    if (pkFields.length === 0) {
      throw new NotFoundException(`Table '${model.name}' has no primary key`);
    }

    // Single primary key
    if (pkFields.length === 1) {
      const pkField = pkFields[0];
      const field = model.fields.find((f: any) => f.name === pkField);

      // Convert id to appropriate type
      let value: any = id;
      if (field?.type === 'Int' || field?.type === 'BigInt') {
        value = parseInt(id, 10);
        if (isNaN(value)) {
          throw new NotFoundException(`Invalid ID format for ${model.name}`);
        }
      }

      return { [pkField]: value };
    }

    // Composite primary key - expect JSON
    try {
      const parsedId = JSON.parse(id);

      // Validate all pk fields are present
      for (const pkField of pkFields) {
        if (parsedId[pkField] === undefined) {
          throw new NotFoundException(
            `Missing primary key field '${pkField}' for ${model.name}. ` +
            `Required fields: ${pkFields.join(', ')}`
          );
        }
      }

      // Build composite where clause
      const whereClause: Record<string, any> = {};
      for (const pkField of pkFields) {
        const field = model.fields.find((f: any) => f.name === pkField);
        let value = parsedId[pkField];

        // Convert to appropriate type
        if (field?.type === 'Int' || field?.type === 'BigInt') {
          value = parseInt(value, 10);
        }

        whereClause[pkField] = value;
      }

      // For Prisma composite keys, wrap in the composite key name
      // e.g., { caseid_productid: { caseid: 123, productid: "ABC" } }
      const compositeKeyName = pkFields.join('_');
      return { [compositeKeyName]: whereClause };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;

      throw new NotFoundException(
        `Invalid ID format for composite key table '${model.name}'. ` +
        `Expected JSON with fields: ${pkFields.join(', ')}. ` +
        `Example: {"${pkFields[0]}":"value1","${pkFields[1]}":"value2"}`
      );
    }
  }

  /**
   * Check if table has composite primary key
   */
  private hasCompositePrimaryKey(model: any): boolean {
    return this.getPrimaryKeyFields(model).length > 1;
  }

  /**
   * Convert data field values to correct types based on Prisma model definition
   * Empty strings, undefined values are converted to null
   */
  private convertFieldTypes(model: any, data: Record<string, any>): Record<string, any> {
    const converted: Record<string, any> = {};

    for (const [key, value] of Object.entries(data)) {
      const field = model.fields.find((f: any) => f.name === key);

      // If field not found in model, keep as is
      if (!field) {
        converted[key] = value;
        continue;
      }

      // Convert null, undefined, or empty string to null
      if (value === null || value === undefined || value === '') {
        converted[key] = null;
        continue;
      }

      // Convert based on Prisma type
      switch (field.type) {
        case 'Int':
          converted[key] = parseInt(value, 10);
          if (isNaN(converted[key])) converted[key] = null;
          break;
        case 'BigInt':
          try {
            converted[key] = BigInt(value);
          } catch {
            converted[key] = null;
          }
          break;
        case 'Float':
        case 'Decimal':
          converted[key] = parseFloat(value);
          if (isNaN(converted[key])) converted[key] = null;
          break;
        case 'Boolean':
          converted[key] = value === 'true' || value === true;
          break;
        case 'String':
          converted[key] = String(value).trim() || null;
          break;
        default:
          converted[key] = value;
      }
    }

    return converted;
  }
}
