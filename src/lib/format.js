// 'YYYY-MM-DD' (from a Postgres date column) -> "3 Nov 2026", read in local time so it never shifts a day.
export function fmtDate(value) {
  if (!value) return ''
  const d = new Date(`${value}T00:00:00`)
  if (isNaN(d)) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function fmtDateRange(start, end) {
  if (start && end) return `${fmtDate(start)} – ${fmtDate(end)}`
  if (start) return `From ${fmtDate(start)}`
  if (end) return `Until ${fmtDate(end)}`
  return ''
}

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
export function fmtMoney(value) {
  if (value == null || value === '') return '—'
  return aud.format(Number(value))
}
