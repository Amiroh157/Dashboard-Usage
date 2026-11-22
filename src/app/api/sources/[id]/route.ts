import { NextResponse } from "next/server";
import { buildDashboard, exclusive, getStore, saveStore } from "@/lib/store";

export const runtime = "nodejs";

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return exclusive(async () => {
    const store = await getStore();
    const next = store.sources.filter((source) => source.id !== id);
    if (next.length === store.sources.length) return NextResponse.json({ error: "File tidak ditemukan." }, { status: 404 });
    store.sources = next;
    await saveStore(store);
    return NextResponse.json(buildDashboard(store));
  });
}
