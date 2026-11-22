import Link from "next/link";

export default function NotFound() {
  return <main className="not-found"><div className="not-found-mark">404</div><h1>Halaman tidak ditemukan.</h1><p>Kembali ke buku pemakaian untuk melihat data alat dan tukang.</p><Link href="/">Kembali ke dashboard <span aria-hidden="true">↗</span></Link></main>;
}
