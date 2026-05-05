import type { ProcurementItemComplianceFlag } from "@/lib/procurement-officer/items";
import type { ItemCategoryRow } from "./types";

export function buildWorkspaceHref(
  pathname: string,
  searchParams: URLSearchParams,
): string {
  const nextQuery = searchParams.toString();
  return nextQuery.length > 0 ? `${pathname}?${nextQuery}` : pathname;
}

export function resolveQuickAddCategoryId(args: {
  categories: readonly ItemCategoryRow[];
  currentCategoryId: string;
  draftCategoryId?: string | null;
}): string {
  if (
    args.categories.some(
      (category) => category.id === args.currentCategoryId && category.isActive,
    )
  ) {
    return args.currentCategoryId;
  }

  if (
    args.draftCategoryId &&
    args.categories.some(
      (category) => category.id === args.draftCategoryId && category.isActive,
    )
  ) {
    return args.draftCategoryId;
  }

  return args.categories.find((category) => category.isActive)?.id ?? "";
}

export function parsePriceInput(value: string): number | null {
  if (value.trim().length === 0) {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

export function formatComplianceFlagLabel(
  flag: ProcurementItemComplianceFlag,
): string {
  if (flag === "agpo") {
    return "AGPO";
  }

  if (flag === "pwd") {
    return "PWD";
  }

  return "Local Content";
}

export async function readFileAsBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";

  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index] as number);
  }

  return window.btoa(binary);
}

export function downloadBase64File(fileName: string, payload: string): void {
  const anchor = document.createElement("a");
  anchor.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${payload}`;
  anchor.download = fileName;
  anchor.click();
}
