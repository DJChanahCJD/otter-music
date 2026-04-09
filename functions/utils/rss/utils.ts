export function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/gi, (m, p1) => 
      ({ nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" })[p1.toLowerCase()] || m
    )
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeUrl(url?: string, baseUrl?: string): string | null {
  if (!url) return null;
  try { return new URL(url, baseUrl).toString(); } 
  catch { return null; }
}
