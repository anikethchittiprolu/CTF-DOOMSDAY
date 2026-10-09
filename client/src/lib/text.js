export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Safe minimal markdown. Everything is escaped first, so no HTML from a challenge can run. */
export function renderText(src) {
  let t = esc(src);
  t = t.replace(/```([\s\S]*?)```/g, (_, c) => `<pre>${c.trim()}</pre>`);
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[\s(])_([^_\n]+)_(?=[\s.,;:)]|$)/g, '$1<em>$2</em>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+|\/[^\s)]*)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return t.split(/\n{2,}/).map((p) => (p.startsWith('<pre>') ? p : `<p>${p.replace(/\n/g, '<br>')}</p>`)).join('');
}

/** Split broadcast text into caption beats. */
export function sentences(text) {
  return String(text).match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [];
}
export const readMs = (s) => Math.max(1600, Math.min(6500, 700 + s.split(/\s+/).length * 330));
