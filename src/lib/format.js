// 'YYYY-MM-DD' (from a Postgres date column) -> "3 Nov 2026", read in local time so it never shifts a day.
export function fmtDate(value) {
  if (!value) return ''
  const d = new Date(`${value}T00:00:00`)
  if (isNaN(d)) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
// Short date for lists: "14 Nov", with the year only when it is not this year.
export function fmtShort(value) {
  if (!value) return ''
  const d = new Date(`${value}T00:00:00`)
  if (isNaN(d)) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${d.getFullYear() === new Date().getFullYear() ? '' : ` ${d.getFullYear()}`}`
}

export function fmtDateRange(start, end) {
  if (start && end) return `${fmtShort(start)} – ${fmtShort(end)}`
  if (start) return `From ${fmtShort(start)}`
  if (end) return `Until ${fmtShort(end)}`
  return ''
}

const aud = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })
export function fmtMoney(value) {
  if (value == null || value === '') return '—'
  return aud.format(Number(value))
}
