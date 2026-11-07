import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
  align?: "left" | "right" | "center";
};

export function DataTable<T>({
  rows,
  columns,
  getKey,
  empty,
  className,
  rowClassName,
  compact = false,
}: {
  rows: T[];
  columns: Column<T>[];
  getKey: (row: T, index: number) => string;
  empty?: ReactNode;
  className?: string;
  rowClassName?: (row: T) => string | undefined;
  compact?: boolean;
}) {
  if (!rows.length && empty) {
    return <div className={className}>{empty}</div>;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full min-w-[560px] border-collapse text-left">
        <thead>
          <tr className="border-b border-border-subtle">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "type-eyebrow whitespace-nowrap px-3 py-2 text-foreground-muted",
                  column.align === "right" && "text-right",
                  column.align === "center" && "text-center",
                  column.headerClassName,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getKey(row, index)}
              className={cn(
                "border-b border-border-subtle/70 transition-colors last:border-0 hover:bg-foreground/[0.025]",
                rowClassName?.(row),
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    compact ? "px-3 py-1.5 text-[11.5px]" : "px-3 py-2.5 text-[12px]",
                    "text-foreground-secondary",
                    column.align === "right" && "text-right",
                    column.align === "center" && "text-center",
                    column.className,
                  )}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
