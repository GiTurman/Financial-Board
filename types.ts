
export type Language = 'GE' | 'EN';

export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER', // Generic manager if needed
  FIN_DIRECTOR = 'FIN_DIRECTOR',
  FOUNDER = 'FOUNDER',
  CEO = 'CEO',
  COMMERCIAL_DIRECTOR = 'COMMERCIAL_DIRECTOR',
  BIZ_DEV = 'BIZ_DEV', 
  TECH_DIRECTOR = 'TECH_DIRECTOR',
  ADMIN = 'ADMIN', 
  ACCOUNTANT = 'ACCOUNTANT',
  SUB_ACCOUNTANT = 'SUB_ACCOUNTANT', // New Role: ბუღალტერი
  PARTS_MANAGER = 'PARTS_MANAGER' // ნაწილების მენეჯერი
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  managerId?: string; // Corresponds to direct_manager_uid
}

export enum RequestStatus {
  DRAFT = 'draft',
  
  // LEVEL 2: Department Head Approval
  WAITING_DEPT_APPROVAL = 'waiting_dept_approval',
  
  // LEVEL 3: Financial Council (Director & FD Review)
  COUNCIL_REVIEW = 'council_review',
  
  // LEVEL 3.5: Approved by FD in Council (Input for Step 11)
  FD_APPROVED = 'fd_approved',

  // LEVEL 4: FD Final Confirmation (Ultimate green light)
  FD_FINAL_CONFIRM = 'fd_final_confirm',
  
  // LEVEL 4.5: Step 11 Output / Step 12 Input
  READY_FOR_PAYMENT = 'ready_for_payment', 

  // LEVEL 4.8: Step 12 Output / Accounting Input
  DISPATCHED_TO_ACCOUNTING = 'dispatched_to_accounting',

  // LEVEL 5: Accounting (Approved for Payment) - Legacy/Alias
  APPROVED_FOR_PAYMENT = 'approved_for_payment',
  
  PAID = 'paid',
  PENDING_BOARD_CLOSURE = 'pending_board_closure',

  // ARCHIVE & RETURN
  REJECTED = 'rejected',
  RETURNED_TO_SENDER = 'returned_to_sender',
  RETURNED_TO_MANAGER = 'returned_to_manager', // PROMPT 4.1-009
}

export enum Currency {
  GEL = 'GEL',
  USD = 'USD',
  EUR = 'EUR',
}

export enum Priority {
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4,
}

export interface BoardSession {
  id: string;
  weekDate: string; // ISO string representing the Thursday of that week
  startTime: string;
  endTime?: string;
  isActive: boolean;
  attendees: string[]; // List of User IDs
  initiatorId: string;
}

export interface ExpenseRequest {
  id: string;
  userId: string;
  requesterName: string;
  department: string;
  managerId: string; // The manager pending approval
  date: string;
  
  category: string;
  itemName: string; 
  
  // Financials
  quantity: number;
  unitPrice: number;
  currency: Currency;
  totalAmount: number;

  // Justification
  description: string; 
  revenuePotential: string;
  priority: Priority;

  // Market Research
  alternativesChecked: boolean;
  selectedOptionReason: string;

  // Board Review Fields
  directorNote?: string; 
  finDirectorNote?: string; 
  discussionResult?: string; 
  lastComment?: string; 
  
  // PROMPT 401: Exclusive FD Control
  assignedFundId?: string; 

  status: RequestStatus;
  createdAt: string;
  updatedAt?: string;
  isTestData?: boolean; 

  // PROMPT 6.3-010: Add mandatory boardDate field
  boardDate: string; 
}

// Data structure for a single debt/credit record (PROMPT 6.1-011)
export interface DebtRecord {
  id: string;
  name: string;
  previousBalance: number;
  increase: number;
  decrease: number;
  currentBalance: number;
  comment: string;
  isTestData?: boolean;
}

// PROMPT 6.1-012: Centralized CashInflowRecord type
export interface CashInflowRecord {
  id: string;
  name: string;
  category: 'პროექტები' | 'სერვისები' | 'ნაწილები';
  budgeted: number;
  actual: number;
  comment: string;
  timestamp: string;
  authorId: string;
  date?: string; // For archive
  isTestData?: boolean;
}


// --- BANKING API TYPES (Prompt 400 & 401 & 402) ---
export interface BankAccount {
  id: string;
  accountName: string;
  bankName: string;
  iban: string;
  currency: Currency;
  currentBalance: number;
  lastSync: string;
  // Mapping logic: Accounts are mapped to Revenue Categories (Clauses)
  mappedCategoryId?: string;
  // Prompt 402: Hybrid Sync Logic
  isAutoSync: boolean; 
}

export interface RevenueCategory {
  id: string;
  name: string;
  description: string;
  plannedAmount: number; // Budgeted
  actualAmount?: number;
}

export interface ExpenseFund {
  id: string;
  name: string;
  description: string;
  category: 'Direct' | 'Marginal' | 'Adjustable' | 'Special';
}

// --- PROMPT 409: Fund Balance Interface ---
export interface FundBalance {
  id: string;
  name: string;
  totalAllocated: number;
  totalSpent: number;
  remaining: number;
}


// PROMPT 6.3-008: Update MasterReportData for detailed reporting
export interface MasterReportData {
  revenues: RevenueCategory[];
  funds: FundBalance[];
  expenseAnalysis: { 
    department: string; 
    totalApproved: number; 
    requestCount: number; 
    totalRequested: number; 
  }[];
  debtors: DebtRecord[];
  creditors: DebtRecord[];
  // FIX: Add debtAnalysis to support UI component's data structure
  debtAnalysis: {
    debtors: { increase: number; decrease: number; currentBalance: number };
    creditors: { increase: number; decrease: number; currentBalance: number };
  };
}

// PROMPT 6.7-002: Project Revenue Module Types
export interface ProjectTranche {
  id: string;
  percentage: number;
  month: number; // 0-11 for Jan-Dec
  year: number;
}

export interface ProjectRevenue {
  id: string;
  clientName: string;
  contractDate: string; // ISO string
  durationInWeeks: number;
  contractNumber: string;
  productType: string;
  brand: string;
  product: string;
  unit: string;
  numberOfFloors: number;
  quantity: number;
  value: number;
  currency: Currency;
  totalReceived: number; // in project's currency
  tranches: ProjectTranche[];
  priceAnalysisUnitPrice?: number;
  priceAnalysisFloorPrice?: number;
  priceAnalysisWeeklyPrice?: number;
  priceAnalysisMonthlyPrice?: number;
  status: 'active' | 'terminated';
  terminationDate?: string;
  terminationReason?: string;
}

// PROMPT 6.8-001: Service Revenue Module Types
export interface ServiceRevenue {
  id: string;
  clientName: string;
  contractDate: string; // ISO string
  durationInWeeks: number;
  contractNumber: string;
  productType: string;
  brand: string;
  product: string;
  unit: string;
  floorsOrStops: number;
  quantity: number;
  value: number;
  currency: Currency;
  totalReceived: number; // in project's currency
  tranches: ProjectTranche[];
  priceAnalysisUnitPrice?: number;
  priceAnalysisFloorPrice?: number;
  priceAnalysisWeeklyPrice?: number;
  priceAnalysisMonthlyPrice?: number;
  status: 'active' | 'terminated';
  terminationDate?: string;
  terminationReason?: string;
}

// PROMPT 6.8-002: Part Revenue Module Types
export interface PartRevenue {
  id: string;
  clientName: string;
  contractDate: string; // ISO string
  durationInWeeks: number; // Represents delivery time
  contractNumber: string;
  productType: string;
  brand: string;
  product: string;
  unit: string;
  floorsOrStops: number; // Not applicable, but kept for structural consistency
  quantity: number;
  value: number;
  currency: Currency;
  totalReceived: number;
  tranches: ProjectTranche[];
  priceAnalysisUnitPrice?: number;
  priceAnalysisFloorPrice?: number;
  priceAnalysisWeeklyPrice?: number;
  priceAnalysisMonthlyPrice?: number;
  status: 'active' | 'terminated';
  terminationDate?: string;
  terminationReason?: string;
}

// PROMPT 7.5 - 002: Directive Snapshot for Accounting
export interface DispatchedDirectiveItem {
  fundName: string;
  category: string;
  approvedAmount: number;
}

export interface DirectiveSnapshot {
  id: string;
  weekNumber: number;
  periodStart: string;
  periodEnd: string;
  dispatchedByUserId: string;
  dispatchedByName: string;
  dispatchedAt: string;
  directivesData: DispatchedDirectiveItem[];
  status: 'pending' | 'processed';
  processedAt?: string;
  processedByUserId?: string;
}

// --- NEW: INVOICE TYPES FOR PARTS MODULE ---
export enum InvoiceStatus {
  PENDING_ACCOUNTANT = 'PENDING_ACCOUNTANT', // Sent by Parts Manager, waiting for Accountant
  GENERATED = 'GENERATED',                   // Approved/Priced by Accountant, waiting for PM action
  COMPLETED = 'COMPLETED'                    // Confirmed received by Parts Manager
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // Auto-generated
  creatorId: string;
  creatorName: string;
  clientName: string;
  clientId?: string;     // Added for Template
  clientAddress?: string;// Added for Template
  date: string;
  deliveryTime?: string; // Added for Template
  paymentTerms?: string; // Added for Template
  validUntil?: string;   // Added for Template
  currency: Currency;
  items: InvoiceItem[];
  totalAmount: number;
  status: InvoiceStatus;
  createdAt: string;
}
