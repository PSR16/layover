const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Make any value safe to insert into HTML text or attribute values. */
export function escapeHtml(value) {
  return String(value).replaceAll(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}
