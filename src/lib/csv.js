// CSV for Excel/Numbers: UTF-8 with a byte-order mark, CRLF lines, quotes only where needed.
// Text that starts with = + - @ is prefixed with ' so a spreadsheet never runs it as a formula.
export function csvCell(v) {
  if (v == null) return ''
  let s = String(v)
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header, rows) {
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export const slug = (s) => String(s || 'project').trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'project'
