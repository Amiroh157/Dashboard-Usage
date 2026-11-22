import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseExcel } from "../src/lib/excel";
import { buildDashboard } from "../src/lib/store";
import type { Source } from "../src/lib/types";

async function main() {
  const root = process.cwd();
  const dataDir = path.join(root, "Data");
  const filenames = (await readdir(dataDir)).filter((name) => /\.xlsx$/i.test(name) && !name.startsWith("~$")).sort();
  if (!filenames.length) throw new Error("Tidak ada file .xlsx dalam folder Data.");

  const sources: Source[] = [];
  for (const filename of filenames) {
    const source = await parseExcel(await readFile(path.join(dataDir, filename)), filename);
    sources.push({ ...source, sample: true });
    console.log(`${filename}: ${source.tools.length} alat, ${source.workers.length} tukang, ${source.usages.length} transaksi`);
  }

  const dashboard = buildDashboard({ sources });
  if (!dashboard.entries.length) throw new Error("Data pemakaian kosong. Periksa file Excel.");
  const target = path.join(root, "static-site", "public", "data", "dashboard.json");
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(dashboard), "utf8");
  console.log(`JSON statis siap: ${dashboard.entries.length} transaksi, ${dashboard.sources.length} file sumber.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
