import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import type { Source, Tool, Usage, Worker } from "./types";

const text = (value: unknown): string => {
  if (value == null) return "";
  if (typeof value === "object" && !(value instanceof Date)) {
    const cell = value as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (cell.text !== undefined) return String(cell.text).trim();
    if (cell.result !== undefined) return text(cell.result);
    if (cell.richText) return cell.richText.map((part) => part.text).join("").trim();
  }
  return String(value).trim();
};

const number = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = text(value).replace(/[^\d,.-]/g, "");
  if (!raw) return 0;
  // Excel numeric cells are preferred; this handles common Indonesian formatted strings.
  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : /^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, "") : raw;
  return Number(normalized) || 0;
};

const date = (value: unknown): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 19).replace("T", " ");
  }
  if (typeof value === "number") {
    const parsed = new Date(Math.round((value - 25569) * 86400000));
    return date(parsed);
  }
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 19).replace("T", " ");
  const match = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(.*)$/);
  if (match) return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}${match[4] || ""}`;
  return "";
};

const clean = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export async function parseExcel(buffer: Buffer, filename: string): Promise<Source> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const tools: Tool[] = [];
  const workers: Worker[] = [];
  const usages: Usage[] = [];

  for (const sheet of workbook.worksheets) {
    let kind: "tool" | "worker" | "usage" | null = null;
    let fields: Record<string, number> = {};
    sheet.eachRow((row) => {
      const values = Array.from({ length: Math.min(row.cellCount, 40) }, (_, index) => text(row.getCell(index + 1).value));
      const normalized = values.map(clean);
      const find = (...terms: string[]) => normalized.findIndex((cell) => terms.some((term) => cell === term));

      if (find("qty keluar") >= 0 && find("pengrajin") >= 0 && find("code") >= 0) {
        kind = "usage";
        fields = { code: find("code") + 1, name: find("name") + 1, unit: find("unit") + 1,
          qty: find("qty keluar") + 1, note: find("note") + 1, date: find("create date") + 1,
          worker: find("pengrajin") + 1, admin: find("admin") + 1 };
        return;
      }
      if (find("last buyprice", "last buy price") >= 0 && find("code") >= 0) {
        kind = "tool";
        fields = { code: find("code") + 1, name: find("name") + 1,
          price: find("last buyprice", "last buy price") + 1, unit: find("unit") + 1 };
        return;
      }
      if (find("nama karyawan") >= 0 && find("divisi") >= 0) {
        kind = "worker";
        fields = { name: find("nama karyawan") + 1, division: find("divisi") + 1 };
        return;
      }
      if (!kind) return;
      const get = (key: string) => fields[key] > 0 ? row.getCell(fields[key]).value : null;
      if (kind === "tool") {
        const code = text(get("code"));
        if (code) tools.push({ code, name: text(get("name")), price: number(get("price")), unit: text(get("unit")) });
      } else if (kind === "worker") {
        const name = text(get("name"));
        if (name) workers.push({ name, division: text(get("division")) });
      } else {
        const code = text(get("code"));
        const worker = text(get("worker"));
        const stamp = date(get("date"));
        if (code && worker && stamp) {
          usages.push({
            code, name: text(get("name")), unit: text(get("unit")),
            qty: number(get("qty")), note: text(get("note")),
            date: stamp, worker, admin: text(get("admin")),
          });
        }
      }
    });
  }

  if (!tools.length && !workers.length && !usages.length) {
    throw new Error(`${filename}: sheet tidak dikenali. Pastikan kolom Excel sesuai format data alat, pemakaian, atau divisi tukang.`);
  }
  return {
    id: createHash("sha256").update(buffer).digest("hex"),
    name: filename,
    importedAt: new Date().toISOString(),
    tools, workers, usages,
  };
}
