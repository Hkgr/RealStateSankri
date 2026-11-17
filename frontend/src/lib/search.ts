/** Normalises Arabic text so search ignores diacritics, hamza forms, ta marbuta and letter case. */
export function normalizeArabic(text: string): string {
  return text
    .normalize('NFKC')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .trim()
}

/** True when every word typed in the search box appears somewhere in the text (empty search matches all). */
export function matchesSearch(text: string, query: string): boolean {
  const words = normalizeArabic(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = normalizeArabic(text)
  return words.every((word) => haystack.includes(word))
}
