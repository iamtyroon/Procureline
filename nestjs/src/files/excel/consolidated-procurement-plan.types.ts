export interface ConsolidatedProcurementPlanExport {
  reportName: string;
  institutionName: string;
  fiscalYear: string;
  generatedAt: string | Date;
  generatedBy: string;
  exportId: string;
  consolidationId: string;
  snapshotId: string;
  tenantId?: string;
  sourcePlanIds: string[];
  selectedDepartmentIds: string[];
  sourceSnapshot: {
    capturedAt: string | Date;
    capturedBy?: string;
    notes?: string;
  };
  departments: ConsolidatedDepartmentSection[];
  summary?: Partial<ConsolidatedPlanSummary>;
  compliance: ConsolidatedComplianceSummary;
  audit?: Record<string, string | number | boolean | null | undefined>;
  serviceVersion?: string;
}

export interface ConsolidatedPlanSummary {
  annualGrandTotal: number;
  departmentTotals: Array<{ departmentId: string; departmentName: string; annualTotal: number }>;
  categoryTotals: Array<{ category: string; annualTotal: number }>;
  quarterlyTotals: {
    q1: number;
    q2: number;
    q3: number;
    q4: number;
  };
}

export interface ConsolidatedComplianceSummary {
  agpo: ComplianceMetric;
  pwd: ComplianceMetric;
  localContent: ComplianceMetric;
}

export interface ComplianceMetric {
  targetPercentage: number;
  actualPercentage: number;
  targetAmount: number;
  actualAmount: number;
  q1Amount?: number;
  q2Amount?: number;
  q3Amount?: number;
  q4Amount?: number;
  variance: number;
  sourceNotes?: string;
}

export interface ConsolidatedDepartmentSection {
  departmentId: string;
  departmentName: string;
  voteNumber?: string;
  categories: ConsolidatedCategorySection[];
  processSections?: ConsolidatedProcessSections;
}

export interface ConsolidatedCategorySection {
  category: string;
  items: ConsolidatedProcurementItem[];
}

export interface ConsolidatedProcurementItem {
  voteNumber: string;
  itemDescription: string;
  unitOfMeasure: string;
  quantity: number;
  unitPrice: number;
  procurementMethod: string;
  sourceOfFunds: string;
  estimatedUnitCost: number;
  q1Quantity: number;
  q1Cost?: number;
  q2Quantity: number;
  q2Cost?: number;
  q3Quantity: number;
  q3Cost?: number;
  q4Quantity: number;
  q4Cost?: number;
  annualTotal?: number;
  category?: string;
}

export interface ConsolidatedProcessSections {
  planned?: Record<string, string | number | Date | null | undefined>;
  actual?: Record<string, string | number | Date | null | undefined>;
  variance?: Record<string, string | number | Date | null | undefined>;
}

export interface GeneratedWorkbook {
  fileName: string;
  workbookBase64: string;
}
