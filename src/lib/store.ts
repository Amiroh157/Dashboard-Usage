import { readFile, readdir, writeFile, mkdir, rename } from "node:fs/promises";
import path from "node:path";
import { parseExcel } from "./excel";
import type { DashboardData, Entry, Store, Usage } from "./types";

const storageDir = path.join(process.cwd(), "storage");
const storageFile = path.join(storageDir, "data.json");
const normalize = (value: string) => value.trim().toLocaleUpperCase("id-ID").replace(/\s+/g, " ");

// Serialize mutations so concurrent uploads cannot overwrite one another.
let queue: Promise<unknown> = Promise.resolve();
export function exclusive<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
}

export async function getStore(): Promise<Store> {
  try {
    return JSON.parse(await readFile(storageFile, "utf8")) as Store;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const sources: Store["sources"] = [];
  const dataDir = path.join(process.cwd(), "Data");
  try {
    for (const filename of (await readdir(dataDir)).filter((file) => /\.xlsx?$/i.test(file) && !file.startsWith("~$")).sort()) {
      try {
        sources.push({ ...(await parseExcel(await readFile(path.join(dataDir, filename)), filename)), sample: true });
      } catch (error) {
        console.warn(`Tidak dapat membaca ${filename}:`, error);
      }
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const store = { sources };
  await saveStore(store);
  return store;
}

export async function saveStore(store: Store): Promise<void> {
  await mkdir(storageDir, { recursive: true });
  const temp = path.join(storageDir, `data-${process.pid}-${Math.random().toString(36).slice(2)}.tmp`);
  await writeFile(temp, JSON.stringify(store), "utf8");
  await rename(temp, storageFile);
}

const usageKey = (usage: Usage) =>
  [usage.date, usage.note, usage.code, usage.worker, usage.qty, usage.admin, usage.unit, usage.name]
    .map((value) => normalize(String(value))).join("\u001f");

export function buildDashboard(store: Store): DashboardData {
  const tools = new Map<string, (typeof store.sources)[number]["tools"][number]>();
  const workers = new Map<string, string>();
  // The latest imported catalogue takes precedence for the current calculated cost.
  for (const source of store.sources) {
    for (const tool of source.tools) tools.set(normalize(tool.code), tool);
    for (const worker of source.workers) workers.set(normalize(worker.name), worker.division);
  }

  const seen = new Map<string, number>();
  let duplicateRows = 0;
  const entries: Entry[] = [];
  for (const source of store.sources) {
    const occurrences = new Map<string, number>();
    for (const [rowIndex, usage] of source.usages.entries()) {
      const key = usageKey(usage);
      const index = (occurrences.get(key) ?? 0) + 1;
      occurrences.set(key, index);
      if (index <= (seen.get(key) ?? 0)) {
        duplicateRows++;
        continue;
      }
      seen.set(key, index);
      const tool = tools.get(normalize(usage.code));
      const division = workers.get(normalize(usage.worker));
      entries.push({
        ...usage, id: `${source.id.slice(0, 10)}-${rowIndex}`,
        name: usage.name || tool?.name || usage.code,
        unit: usage.unit || tool?.unit || "",
        division: division || "Belum terdaftar",
        price: tool ? tool.price : null,
        cost: usage.qty * (tool?.price ?? 0),
        priceMissing: !tool,
        divisionMissing: !division,
      });
    }
  }

  return {
    entries,
    sources: store.sources.map(({ id, name, importedAt, sample, tools, workers, usages }) => ({
      id, name, importedAt, sample, tools: tools.length, workers: workers.length, usages: usages.length,
    })),
    toolCount: tools.size,
    workerCount: workers.size,
    duplicateRows,
  };
}
