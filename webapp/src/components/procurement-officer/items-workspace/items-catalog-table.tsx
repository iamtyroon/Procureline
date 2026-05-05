import { Archive } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatProcurementItemQuantityLimits } from "@/lib/procurement-officer/items";
import { formatKesAmount } from "../dashboard/utilities";
import type { ItemRow } from "./types";

export function ItemsCatalogTable(props: {
  rows: ItemRow[];
  onArchive: (row: ItemRow) => void;
  onEdit: (row: ItemRow) => void;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-border/70">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/20 hover:bg-muted/20">
            <TableHead>Item</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Compliance</TableHead>
            <TableHead>Unit</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Qty Limits</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {props.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="align-top">
                <div className="space-y-1">
                  <div className="font-medium text-foreground">{row.name}</div>
                  {row.description && row.description !== row.name ? (
                    <p className="max-w-xl text-sm text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {row.archivedLabel ? (
                      <Badge variant="outline" className="rounded-full">
                        {row.archivedLabel}
                      </Badge>
                    ) : null}
                    {row.procurementMethod ? (
                      <span>{row.procurementMethod}</span>
                    ) : null}
                    {row.sourceOfFunds ? <span>{row.sourceOfFunds}</span> : null}
                    {row.lastPriceChangedAt ? (
                      <span>
                        Price updated{" "}
                        {new Date(row.lastPriceChangedAt).toLocaleDateString()}
                      </span>
                    ) : null}
                  </div>
                </div>
              </TableCell>
              <TableCell className="align-top">
                <Badge variant="secondary" className="rounded-full">
                  {row.categoryName}
                </Badge>
              </TableCell>
              <TableCell className="align-top text-sm text-muted-foreground">
                {row.complianceSummary}
              </TableCell>
              <TableCell className="align-top text-sm text-muted-foreground">
                {row.unitOfMeasurement ?? "Not set"}
              </TableCell>
              <TableCell className="align-top text-sm text-muted-foreground">
                {formatKesAmount(row.unitPrice ?? 0)}
              </TableCell>
              <TableCell className="align-top text-sm text-muted-foreground">
                {formatProcurementItemQuantityLimits({
                  maxQuantity: row.maxQuantity,
                  minQuantity: row.minQuantity,
                })}
              </TableCell>
              <TableCell className="align-top">
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => props.onEdit(row)}
                  >
                    Edit
                  </Button>
                  {row.isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => props.onArchive(row)}
                    >
                      <Archive className="mr-2 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
