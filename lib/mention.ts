/**
 * F9 mention parser — murni, tanpa I/O.
 * `@nama` tidak boleh ditempel huruf/angka/`@` di depannya agar email
 * (a@mail.com) tidak kehitung; tanda buka kurung/kutip tetap diterima.
 * Karakter nama: huruf, angka, `_`, `.`, `-`. Tanda baca akhir kalimat
 * (`@budi.`, `@ani,`) dikupas. Hasil unik sesuai urutan kemunculan.
 */
export function parseMentions(body: string | null | undefined): string[] {
  if (!body) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const re = /(?<![\w@])@([A-Za-z0-9_][A-Za-z0-9_.-]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body)) !== null) {
    const name = m[1].replace(/[.-]+$/, "");
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
