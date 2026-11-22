import { NextResponse } from "next/server";
import { parseExcel } from "@/lib/excel";
import { buildDashboard, exclusive, getStore, saveStore } from "@/lib/store";
import type { Source } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const files = form.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return NextResponse.json({ error: "Pilih minimal satu file Excel." }, { status: 400 });

    const parsed: Source[] = [];
    const errors: string[] = [];
    for (const file of files) {
      if (!/\.xlsx$/i.test(file.name) || file.name.startsWith("~$")) {
        errors.push(`${file.name}: hanya file .xlsx yang didukung.`);
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        errors.push(`${file.name}: ukuran maksimal per file 50 MB.`);
        continue;
      }
      try {
        parsed.push(await parseExcel(Buffer.from(await file.arrayBuffer()), file.name));
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `${file.name}: gagal dibaca.`);
      }
    }
    if (!parsed.length) return NextResponse.json({ error: errors.join(" ") }, { status: 400 });

    return await exclusive(async () => {
      const store = await getStore();
      let added = 0;
      let skipped = 0;
      for (const source of parsed) {
        if (store.sources.some((existing) => existing.id === source.id)) skipped++;
        else { store.sources.push(source); added++; }
      }
      if (added) await saveStore(store);
      return NextResponse.json({ ...buildDashboard(store), result: { added, skipped, errors } });
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Upload gagal. Coba ulangi dengan file Excel yang valid." }, { status: 500 });
  }
}
