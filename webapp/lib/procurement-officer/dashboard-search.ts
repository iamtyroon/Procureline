export const PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS = {
  fiscalYear: "poFiscalYear",
} as const;

interface SearchParamsReader {
  get(name: string): string | null;
}

export function extractProcurementOfficerDashboardSearchParams(
  searchParams: SearchParamsReader,
): URLSearchParams {
  const nextSearchParams = new URLSearchParams();
  const fiscalYear =
    searchParams
      .get(PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear)
      ?.trim() ?? "";

  if (fiscalYear.length > 0) {
    nextSearchParams.set(
      PROCUREMENT_OFFICER_DASHBOARD_QUERY_KEYS.fiscalYear,
      fiscalYear,
    );
  }

  return nextSearchParams;
}
