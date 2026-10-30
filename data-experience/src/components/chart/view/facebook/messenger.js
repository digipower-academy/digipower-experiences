// Shared by the Messenger views of the facebook experience

export function formatDate(iso, locale) {
  if (!iso) {
    return '–'
  }
  return new Intl.DateTimeFormat(locale || 'en', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(new Date(iso))
}

export function formatNumber(value, locale) {
  return typeof value === 'number' ? value.toLocaleString(locale || 'en') : '–'
}

// "{json} JSON files" with { json: 3 } → "3 JSON files"
export function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) =>
    key in values ? values[key] : match
  )
}

// Text from the export shown inside chart tooltips, which ApexCharts inserts as HTML
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c])
}
