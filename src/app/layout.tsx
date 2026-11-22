import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buku Pakai | Dashboard Pemakaian Alat",
  description: "Analisis pemakaian alat, tukang, divisi, dan biaya dari file Excel secara lokal.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
