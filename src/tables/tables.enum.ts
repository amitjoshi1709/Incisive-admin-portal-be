/**
 * Enum defining which tables are exposed via the /tables API.
 * Only tables listed here will be accessible through the API.
 * Add or remove tables as needed.
 */
export enum AllowedTable {
  // Core tables
  USERS = 'users',
  AUDIT_LOGS = 'audit_logs',
  LAB_PRODUCT_MAAPING = 'lab_product_mapping',
  LAB_PRACTICE_MAAPING = 'lab_practice_mapping',
  INCISIVE_PRODUCT_CATALOG = 'incisive_product_catalog',
  ORDERS_STAGE = 'orders_stage',
  ORDERS_CURRENT = 'orders_current',
  ORDERS_HISTORY = 'orders_history',

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
  AllowedTable.AUDIT_LOGS,
];

/**
 * Helper to get all allowed table names as an array
 */
export function getAllowedTableNames(): string[] {
  return Object.values(AllowedTable);
}
