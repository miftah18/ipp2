import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

type Column = { label: string; key: string };
type Row = Record<string, any>;

interface Props {
  data: Row[];
  columns: Column[];
  filename?: string;
}

function toCSV(data: Row[], columns: Column[]): string {
  const header = columns.map((c) => `"${c.label}"`).join(",");
  const rows = data.map((row) =>
    columns
      .map((c) => {
        const val = c.key.split(".").reduce((obj, k) => obj?.[k], row) ?? "";
        return `"${String(val).replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  return [header, ...rows].join("\n");
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob(["\uFEFF" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function toPrintHTML(data: Row[], columns: Column[], title: string): string {
  const now = new Date().toLocaleDateString("id-ID", { dateStyle: "full" });
  const rows = data
    .map(
      (row) =>
        `<tr>${columns
          .map((c) => {
            const val = c.key.split(".").reduce((obj, k) => obj?.[k], row) ?? "—";
            return `<td>${String(val)}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
  h1 { font-size: 16px; margin-bottom: 4px; }
  p.subtitle { font-size: 11px; color: #666; margin: 0 0 16px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #1a1a2e; color: white; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; }
  td { padding: 7px 10px; border-bottom: 1px solid #eee; font-size: 11px; }
  tr:nth-child(even) td { background: #f9f9f9; }
  @media print { button { display: none; } }
</style></head><body>
<h1>${title}</h1>
<p class="subtitle">Dicetak pada ${now} &mdash; Total ${data.length} data</p>
<table><thead><tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr></thead>
<tbody>${rows}</tbody></table>
<br><button onclick="window.print()">🖨️ Cetak / Simpan PDF</button>
</body></html>`;
}

export function ExportButton({ data, columns, filename = "export" }: Props) {
  const [loading, setLoading] = useState(false);

  const handleCSV = () => {
    if (!data.length) {
      toast({ title: "Tidak ada data", description: "Belum ada data untuk diekspor.", variant: "destructive" });
      return;
    }
    const csv = toCSV(data, columns);
    downloadFile(csv, `${filename}.csv`, "text/csv;charset=utf-8;");
    toast({ title: "Export Berhasil", description: `${data.length} baris diekspor ke CSV.` });
  };

  const handlePrint = () => {
    if (!data.length) {
      toast({ title: "Tidak ada data", description: "Belum ada data untuk dicetak.", variant: "destructive" });
      return;
    }
    const html = toPrintHTML(data, columns, filename);
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Download className="size-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={handleCSV} className="gap-2 text-sm cursor-pointer">
          <FileSpreadsheet className="size-4 text-green-500" />
          Export CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint} className="gap-2 text-sm cursor-pointer">
          <FileText className="size-4 text-blue-400" />
          Cetak / PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
