import { NextResponse } from "next/server";
import { buildDashboard, getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(buildDashboard(await getStore()));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Gagal membaca data. Periksa file sumber dan izin folder storage." }, { status: 500 });
  }
}
