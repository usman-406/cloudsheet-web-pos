export type UserRole = 'admin' | 'cashier';

export interface User {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  pin?: string;
}

export interface PriceHistoryLog {
  id: string;
  timestamp: string;
  old_buy_price: number;
  new_buy_price: number;
  old_sell_price: number;
  new_sell_price: number;
  user: string;
  reason: string;
}

export interface Category {
  id: string;
  name: string;
  code?: string;
  description?: string;
  color?: string;
  icon?: string;
  status: 'ACTIVE' | 'INACTIVE';
  display_order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: string;
  barcode: string;
  name: string;
  category: string;
  brand?: string;
  buy_price: number;
  sell_price: number;
  stock_qty: number;
  min_stock_alert?: number;
  max_stock_level?: number;
  supplier_lead_time_days?: number;
  image_url: string;
  gallery_images?: string[];
  expiry_date?: string;
  shade_code?: string;
  volume_ml?: string;
  shelf_location?: string; // e.g., "Skincare Shelf A-3"
  price_history?: PriceHistoryLog[];
  last_sold_date?: string;
  tax_rate?: number; // Custom product-level tax % override
  is_tax_exempt?: boolean; // When true, 0% tax applies to this product
}

export interface Employee {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'manager' | 'cashier';
  department: string;
  assigned_branch: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  pin: string;
  shift: 'Morning (09:00 - 17:00)' | 'Evening (13:00 - 21:00)' | 'Full Day';
  pos_permissions: string[];
  phone: string;
  email: string;
  created_at: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
  discount_percent: number;
  discount_amount: number;
  final_unit_price: number;
  line_total: number;
  custom_unit_price?: number;
}

export type PaymentMethod = 'Cash' | 'Card' | 'Easypaisa' | 'JazzCash' | 'Split';

export interface SplitPaymentDetail {
  method: Exclude<PaymentMethod, 'Split'>;
  amount: number;
  reference?: string;
}

export interface SaleItem {
  product_id: string;
  barcode: string;
  name: string;
  quantity: number;
  buy_price: number; // Historical buy price at time of transaction
  sell_price: number;
  discount: number;
  total: number;
  returned_qty?: number;
}

export type ReturnCondition = 'RESTOCK_SELLABLE' | 'DAMAGED_WRITE_OFF' | 'EXPIRED_SCRAP';

export type ReturnReason = 
  | 'Defective/Damaged' 
  | 'Wrong Shade/Color' 
  | 'Customer Changed Mind' 
  | 'Allergic Reaction' 
  | 'Expired/Seal Broken' 
  | 'Incorrect Billing Item' 
  | 'Other';

export type RefundMethod = 'Cash' | 'Original_Method' | 'Store_Credit' | 'Card' | 'Easypaisa' | 'JazzCash';

export interface ReturnItem {
  product_id: string;
  barcode: string;
  name: string;
  return_quantity: number;
  original_quantity: number;
  sold_unit_price: number;
  unit_discount: number;
  refund_unit_price: number;
  refund_line_total: number;
  condition: ReturnCondition;
  reason: ReturnReason;
  custom_reason?: string;
}

export interface ReturnTransaction {
  id: string;
  return_no: string; // e.g. "RET-2026-0001"
  original_sale_id: string;
  original_invoice_no: string;
  datetime: string;
  cashier_name: string;
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  items: ReturnItem[];
  items_count: number;
  subtotal_refund: number;
  tax_refund: number;
  total_refund_amount: number;
  refund_method: RefundMethod;
  store_credit_code?: string;
  store_credit_valid_until?: string;
  restocked_items_count: number;
  damaged_items_count: number;
  points_deducted: number;
  notes?: string;
  approved_by?: string;
  status: 'COMPLETED' | 'CANCELLED';
}

export interface Sale {
  id: string;
  invoice_no: string;
  datetime: string; // ISO string or formatted string
  customer_id?: string;
  customer_name: string;
  customer_phone?: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount: number; // overall discount
  total: number;
  paid: number;
  change_due: number;
  payment_method: PaymentMethod;
  split_details?: SplitPaymentDetail[];
  cashier_name: string;
  items: SaleItem[];
  items_json?: string;
  drive_pdf_url?: string;
  status: 'completed' | 'voided' | 'refunded' | 'partially_refunded';
  return_note?: string;
  returned_items?: ReturnItem[];
  total_refunded?: number;
  notes?: string;
}

export interface CustomerCommPref {
  email_receipts: boolean;
  sms_alerts: boolean;
  whatsapp_offers: boolean;
  birthday_offers: boolean;
  opt_out_all: boolean;
}

export interface LoyaltyPointLog {
  id: string;
  date: string;
  type: 'EARNED' | 'REDEEMED' | 'MANUAL_ADJUSTMENT';
  points: number;
  note: string;
  user: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  notes?: string;
  points: number;
  total_spent?: number;
  order_count?: number;
  avg_order_value?: number;
  favorite_category?: string;
  last_visit?: string;
  birthday?: string;
  comm_pref?: CustomerCommPref;
  points_history?: LoyaltyPointLog[];
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'PERCENT' | 'AMOUNT';
  discount_value: number;
  value?: number;
  type?: string;
  max_discount?: number;
  min_subtotal?: number;
  category_restriction?: string;
  expiry_date?: string;
  is_active: boolean;
}

export interface DiscountAuditLog {
  id: string;
  timestamp: string;
  invoice_no: string;
  discount_amount: number;
  discount_type: 'manual' | 'item' | 'cart' | 'coupon' | 'loyalty';
  reason: string;
  approved_by: string;
  cashier: string;
}

export interface Supplier {
  id: string;
  company_name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  outstanding_balance: number;
  notes?: string;
  products_supplied: string[]; // product ids
  last_order_date?: string;
}

export interface SupplierProductCost {
  supplier_id: string;
  product_id: string;
  supplier_sku: string;
  last_cost_price: number;
  avg_purchase_price: number;
}

export type POStatus = 'DRAFT' | 'ORDERED' | 'PARTIALLY_RECEIVED' | 'FULL_RECEIVED' | 'CANCELLED';

export interface POItem {
  product_id: string;
  product_name: string;
  ordered_qty: number;
  received_qty: number;
  damaged_qty: number;
  missing_qty: number;
  unit_cost: number;
  line_total: number;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name: string;
  status: POStatus;
  created_date: string;
  expected_date: string;
  received_date?: string;
  items: POItem[];
  subtotal: number;
  notes?: string;
  created_by: string;
}

export type ExpenseCategory = 
  | 'Rent' 
  | 'Electricity' 
  | 'Salaries' 
  | 'Packaging' 
  | 'Transport' 
  | 'Marketing' 
  | 'Internet' 
  | 'Supplies' 
  | 'Miscellaneous';

export interface Expense {
  id: string;
  date: string;
  title: string;
  category: ExpenseCategory;
  amount: number;
  payment_method?: string;
  note?: string;
  attachment_url?: string;
  created_by?: string;
  status?: 'APPROVED' | 'PENDING' | 'REJECTED';
}

export interface CashShift {
  id: string;
  cashier_name: string;
  start_time: string;
  end_time?: string;
  opening_cash: number;
  cash_sales: number;
  card_sales: number;
  digital_sales: number;
  refunds: number;
  cash_in: number;
  cash_out: number;
  expected_cash: number;
  actual_cash?: number;
  variance?: number;
  variance_reason?: string;
  status: 'OPEN' | 'CLOSED';
  approved_by?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: string;
  read: boolean;
  category: 'inventory' | 'finance' | 'sync' | 'security' | 'approval';
}

export interface FraudAlert {
  id: string;
  timestamp: string;
  type: 'HIGH_DISCOUNT' | 'UNUSUAL_REFUND' | 'PRICE_OVERRIDE' | 'NEGATIVE_STOCK_ATTEMPT' | 'DRAWER_VOID';
  description: string;
  cashier: string;
  status: 'PENDING_REVIEW' | 'VERIFIED' | 'DISMISSED';
}

export interface MongoDbConfig {
  enabled: boolean;
  connection_uri: string; // e.g. "mongodb+srv://admin:••••••••@cluster0.mongodb.net/bloomandcarry_pos?retryWrites=true&w=majority"
  database_name: string; // e.g. "bloomandcarry_cosmetics" or "real.db"
  api_endpoint?: string; // Atlas Data API or REST/GraphQL backend endpoint
  api_key?: string; // Atlas Data API Key / Bearer token
  cluster_name?: string; // e.g. "Atlas-Cluster-AsiaSouth1"
  auto_sync_on_checkout: boolean;
  ssl_enabled: boolean;
  sync_interval_seconds?: number;
  last_synced?: string;
  collections?: {
    products: string;
    sales: string;
    customers: string;
    inventory: string;
    expenses: string;
    shifts: string;
  };
}

export interface ShopSettings {
  shop_name: string;
  tagline: string;
  address: string;
  phone: string;
  website?: string;
  email: string;
  logo_url: string;
  tax_rate: number;
  tax_mode?: 'INCLUSIVE' | 'EXCLUSIVE';
  tax_exempt_categories?: string[];
  category_tax_rates?: Record<string, number>;
  printer_name: string;
  paper_width: '80mm' | '58mm';
  auto_print_receipt: boolean;
  open_cash_drawer: boolean;
  currency_symbol: string;
  currency_code?: string;
  decimal_places?: number;
  date_format?: string;
  time_zone?: string;
  gas_web_app_url: string;
  auto_sync_gas: boolean;
  drive_invoices_folder_id?: string;
  invoice_prefix?: string; // e.g. "BC-2026"
  is_production_mode?: boolean; // true = Live Real System, false = Mock/Demo Mode
  is_demo_mode?: boolean;
  is_test_transaction_mode?: boolean;
  google_spreadsheet_id?: string;
  google_spreadsheet_url?: string;
  google_workspace_email?: string;
  auto_sync_google_sheets?: boolean;
  auto_sync_firestore?: boolean;
  hardware_config?: HardwareConfig;
  mongodb_config?: MongoDbConfig;
}

export type DeviceType = 'printer' | 'scanner' | 'cash_drawer' | 'card_terminal' | 'scale';
export type DeviceHealth = 'online' | 'offline' | 'busy' | 'error';

export interface DeviceStatus {
  device: DeviceType;
  label: string;
  status: DeviceHealth;
  port: string;
  lastPing: string;
  details: string;
}

export interface HardwareConfig {
  printer_name?: string;
  printer_connection: 'usb' | 'serial' | 'network' | 'browser';
  printer_port: string;
  paper_width?: '80mm' | '58mm';
  auto_cut?: boolean;
  feed_lines?: number;
  printer_ip?: string;
  baud_rate: number;
  scanner_port: string;
  scanner_mode: 'keyboard_wedge' | 'serial_com';
  cash_drawer_command: string;
  card_terminal_enabled: boolean;
  card_terminal_ip: string;
  card_terminal_port: number;
  scale_enabled: boolean;
  scale_port: string;
  auto_weight_read: boolean;
}

export interface HardwareJob {
  id: string;
  device: DeviceType;
  action: string;
  payload: any;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'high' | 'normal' | 'low';
  createdAt: string;
  completedAt?: string;
  error?: string;
}

export type CardTerminalStep = 
  | 'idle'
  | 'connecting'
  | 'present_card'
  | 'entering_pin'
  | 'processing'
  | 'approved'
  | 'declined'
  | 'error'
  | 'manual_fallback';

export interface CardTerminalTransaction {
  status: CardTerminalStep;
  amount: number;
  invoice_no: string;
  cardMasked?: string;
  cardType?: string;
  authCode?: string;
  message?: string;
  timestamp: string;
}

export interface InventoryLedgerItem {
  id: string;
  timestamp: string;
  product_id: string;
  product_name: string;
  barcode: string;
  type: 'SALE' | 'STOCK_IN' | 'STOCK_OUT' | 'ADJUSTMENT' | 'VOID_SALE' | 'FIFO_DEDUCTION' | 'RETURN_RESTOCK' | 'DAMAGED_WRITE_OFF';
  qty_before: number;
  qty_change: number;
  qty_after: number;
  batch_no?: string;
  unit_cost: number;
  user_name: string;
  reference_no: string;
}

export interface StockHistoryItem {
  id: string;
  product_id: string;
  product_name: string;
  type: 'IN' | 'OUT' | 'SALE' | 'ADJUSTMENT' | 'RETURN_RESTOCK' | 'DAMAGED_WRITE_OFF';
  qty_change: number;
  new_qty: number;
  date: string;
  note: string;
  user_name: string;
}

export interface StockReservation {
  id: string;
  order_id: string;
  channel: 'e-commerce' | 'phone' | 'manual_reserve';
  customer_name: string;
  product_id: string;
  product_name: string;
  barcode: string;
  reserved_qty: number;
  reserved_at: string;
  expires_at: string;
  status: 'ACTIVE' | 'FULFILLED' | 'CANCELLED' | 'EXPIRED';
}

export interface BackupAuditLog {
  id: string;
  timestamp: string;
  filename: string;
  action: 'EXPORT_ENCRYPTED' | 'RESTORE_DECRYPTED' | 'DRIVE_SYNC' | 'FIRESTORE_SYNC' | 'ROLLBACK';
  user: string;
  size_bytes: number;
  status: 'SUCCESS' | 'FAILED';
  encryption_algorithm: string;
  details?: string;
}

export interface FullSystemBackupPayload {
  version: string;
  exportedAt: string;
  environment: string;
  source: string;
  shopSettings: ShopSettings;
  products: Product[];
  sales: Sale[];
  returns: ReturnTransaction[];
  customers: Customer[];
  expenses: Expense[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  stockHistory: StockHistoryItem[];
  coupons: Coupon[];
  discountLogs: DiscountAuditLog[];
  shifts: CashShift[];
  notifications: AppNotification[];
  users: User[];
  summary: {
    totalProducts: number;
    totalSales: number;
    totalCustomers: number;
    totalExpenses: number;
    totalReturns: number;
    totalSuppliers: number;
    totalShifts: number;
  };
}

export interface CloudBackupRecord {
  id: string;
  timestamp: string;
  version: string;
  created_by: string;
  products_count: number;
  sales_count: number;
  customers_count: number;
  expenses_count: number;
  payload_json: string;
}

export interface SystemErrorLog {
  id: string;
  timestamp: string;
  level: 'CRITICAL' | 'WARNING' | 'ERROR' | 'INFO';
  component: string;
  user_facing_message: string;
  technical_details: string;
  resolved: boolean;
}

export interface BranchStore {
  id: string;
  code: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  is_main_branch: boolean;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface PayrollRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  month: string;
  base_salary: number;
  working_days: number;
  present_days: number;
  overtime_hours: number;
  overtime_rate: number;
  commission_amount: number;
  deductions: number;
  net_salary: number;
  status: 'PAID' | 'PENDING' | 'PROCESSING';
  payment_date?: string;
  payment_method?: string;
}

export type ActiveTab = 
  | 'pos' 
  | 'dashboard' 
  | 'products' 
  | 'categories'
  | 'sales' 
  | 'customers' 
  | 'suppliers'
  | 'purchase_orders'
  | 'expenses' 
  | 'shift_register'
  | 'import_export'
  | 'system_health'
  | 'reservations'
  | 'security_audit'
  | 'employee_productivity'
  | 'automated_tests'
  | 'bi_analytics'
  | 'dead_stock'
  | 'smart_reorder'
  | 'employee_management'
  | 'customer_display'
  | 'emergency_controls'
  | 'settings' 
  | 'gas_guide'
  | 'google_workspace'
  | 'hardware_diagnostics'
  | 'stock_ledger';


