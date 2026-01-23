/**
 * Enum defining which tables are exposed via the /tables API.
 * Only tables listed here will be accessible through the API.
 * Add or remove tables as needed.
 */
export enum AllowedTable {
  // Core tables
  USERS = 'users',
  LAB_PRODUCT_MAAPING = 'lab_product_mapping',
  LAB_PRACTICE_MAAPING = 'lab_practice_mapping',
  INCISIVE_PRODUCT_CATALOG = 'incisive_product_catalog',
  LABS='labs',
  DENTAL_GROUPS='dental_groups',
  DENTAL_PRACTICES='dental_practices',
  FEE_SCHEDULE='fee_schedules',

  // Add more tables here as needed:
  // PRODUCTS = 'products',
  // ORDERS = 'orders',
  // CATEGORIES = 'categories',
  // CUSTOMERS = 'customers',
}

/**
 * Tables that require ADMIN role to access.
 * Must be a subset of AllowedTable values.
 */
export const ADMIN_ONLY_TABLES: string[] = [
  AllowedTable.USERS,
  // AllowedTable.AUDIT_LOGS,
];

/**
 * Helper to get all allowed table names as an array
 */
export function getAllowedTableNames(): string[] {
  return Object.values(AllowedTable);
}
