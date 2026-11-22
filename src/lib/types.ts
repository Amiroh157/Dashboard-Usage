export type Tool = { code: string; name: string; unit: string; price: number };
export type Worker = { name: string; division: string };
export type Usage = {
  code: string;
  name: string;
  unit: string;
  qty: number;
  note: string;
  date: string;
  worker: string;
  admin: string;
};
export type Source = {
  id: string;
  name: string;
  importedAt: string;
  sample?: boolean;
  tools: Tool[];
  workers: Worker[];
  usages: Usage[];
};
export type Store = { sources: Source[] };
export type Entry = Usage & {
  id: string;
  division: string;
  price: number | null;
  cost: number;
  priceMissing: boolean;
  divisionMissing: boolean;
};
export type DashboardData = {
  entries: Entry[];
  sources: (Pick<Source, "id" | "name" | "importedAt" | "sample"> & {
    tools: number;
    workers: number;
    usages: number;
  })[];
  toolCount: number;
  workerCount: number;
  duplicateRows: number;
};
