export function renderScaffoldPage(title: string): string {
  const safeTitle = title
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

  return `<main><h1>${safeTitle}</h1><p>Desktop foundation</p><p>This static scaffold has no AI, RAG, database, or backend connection.</p></main>`;
}
