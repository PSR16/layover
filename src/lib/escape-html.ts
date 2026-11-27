const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Make any value safe to insert into HTML text or attribute values. */
export function escapeHtml(value: unknown): string {
  return String(value).replaceAll(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}
