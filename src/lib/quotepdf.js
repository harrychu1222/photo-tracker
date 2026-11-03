// Builds a text-only quote PDF in the browser (pdf-lib, loaded only when the button is used).
const W = 595.28
const H = 841.89
const M = 50

const aud = (n) => '$' + Number(n).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dmy = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '')

export function addDaysISO(iso, days) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// input: { business, project, quote, tasks: [{ room, name }], milestones: [{ name, amount, due_on }],
//          notes, includeTasks, includeSchedule, date (yyyy-mm-dd) }
export async function buildQuotePdf(input) {
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
  const { business = {}, project, quote, tasks = [], milestones = [], notes = '', includeTasks, includeSchedule, date } = input
  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const bold = await doc.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.12, 0.16, 0.22)
  const grey = rgb(0.4, 0.45, 0.5)
  const safe = (t) => Array.from(String(t ?? '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"')).map((c) => { if (c === '\n') return c; try { font.encodeText(c); return c } catch { return '?' } }).join('')

  let page = doc.addPage([W, H])
  let y = H - M
  const pages = [page]
  const need = (h) => {
    if (y - h < M + 20) {
      page = doc.addPage([W, H])
      pages.push(page)
      y = H - M
    }
  }
  const wrap = (text, f, size, width) => {
    const out = []
    String(text).split('\n').forEach((para) => {
      let line = ''
      para.split(/\s+/).filter(Boolean).forEach((word) => {
        const t = line ? `${line} ${word}` : word
        if (f.widthOfTextAtSize(t, size) <= width) line = t
        else { if (line) out.push(line); line = word }
      })
      out.push(line)
    })
    return out
  }
  const text = (t, { f = font, size = 10, color = ink, x = M, width = W - 2 * M, gap = 3 } = {}) => {
    wrap(safe(t), f, size, width).forEach((ln) => {
      need(size + gap)
      page.drawText(ln, { x, y: y - size, size, font: f, color })
      y -= size + gap
    })
  }
  const space = (n) => { y -= n }
  const rule = () => { need(10); page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.6, color: rgb(0.8, 0.83, 0.86) }); y -= 10 }
  const heading = (t) => { space(8); need(24); text(t, { f: bold, size: 12 }); space(2) }
  const right = (t, x, size, f = font) => page.drawText(safe(t), { x: x - f.widthOfTextAtSize(safe(t), size), y: y - size, size, font: f, color: ink })

  // Header
  text(business.name || 'Quote', { f: bold, size: 18 })
  ;[business.abn && `ABN ${business.abn}`, business.address, [business.phone, business.email].filter(Boolean).join('  |  ')].filter(Boolean).forEach((l) => text(l, { size: 9, color: grey, gap: 2 }))
  space(6)
  rule()
  text('QUOTE', { f: bold, size: 14 })
  space(4)
  const validUntil = addDaysISO(date, Number(business.valid_days) || 30)
  text(`Date: ${dmy(date)}`, { size: 10 })
  text(`Valid until: ${dmy(validUntil)}`, { size: 10 })
  space(6)
  text('Prepared for', { f: bold, size: 10, color: grey })
  text(project.client || project.name, { size: 11 })
  if (project.site_address) text(`Site: ${project.site_address}`, { size: 10 })
  text(`Project: ${project.name}`, { size: 10 })

  if ((notes || '').trim()) { heading('Scope of work'); text(notes, { size: 10 }) }
  if (includeTasks && tasks.length) {
    heading((notes || '').trim() ? 'Work included' : 'Scope of work')
    const rooms = []
    tasks.forEach((t) => { let g = rooms.find((r) => r.room === t.room); if (!g) rooms.push((g = { room: t.room, names: [] })); g.names.push(t.name) })
    rooms.forEach((g) => {
      if (g.room) text(g.room, { f: bold, size: 10, gap: 2 })
      g.names.forEach((n) => text(`-  ${n}`, { size: 10, x: M + 8, width: W - 2 * M - 8, gap: 2 }))
      space(4)
    })
  }

  heading('Price')
  need(30)
  page.drawText('Total price (GST included)', { x: M, y: y - 12, size: 12, font: bold, color: ink })
  right(aud(quote), W - M, 12, bold)
  y -= 18
  text(`Includes GST of ${aud(quote / 11)}`, { size: 9, color: grey })

  if (includeSchedule && milestones.length) {
    heading('Payment schedule')
    need(16)
    page.drawText('Payment', { x: M, y: y - 9, size: 9, font: bold, color: grey })
    page.drawText('Due', { x: W - M - 170, y: y - 9, size: 9, font: bold, color: grey })
    right('Amount', W - M, 9, bold)
    y -= 15
    milestones.forEach((m) => {
      need(15)
      page.drawText(safe(m.name).slice(0, 60), { x: M, y: y - 10, size: 10, font, color: ink })
      page.drawText(m.due_on ? dmy(m.due_on) : 'To be agreed', { x: W - M - 170, y: y - 10, size: 10, font, color: ink })
      right(aud(m.amount), W - M, 10)
      y -= 15
    })
    const total = milestones.reduce((s, m) => s + Number(m.amount || 0), 0)
    rule()
    need(15)
    page.drawText('Total scheduled', { x: M, y: y - 10, size: 10, font: bold, color: ink })
    right(aud(total), W - M, 10, bold)
    y -= 15
  }

  if ((business.terms || '').trim()) { heading('Terms'); text(business.terms, { size: 9 }) }

  heading('Acceptance')
  text('To accept this quote, sign and date below.', { size: 9, color: grey })
  space(26)
  need(30)
  page.drawLine({ start: { x: M, y }, end: { x: M + 230, y }, thickness: 0.6, color: ink })
  page.drawLine({ start: { x: M + 280, y }, end: { x: M + 400, y }, thickness: 0.6, color: ink })
  y -= 12
  page.drawText('Signed', { x: M, y: y - 9, size: 9, font, color: grey })
  page.drawText('Date', { x: M + 280, y: y - 9, size: 9, font, color: grey })

  pages.forEach((p, i) => p.drawText(`Page ${i + 1} of ${pages.length}`, { x: W - M - 50, y: 28, size: 8, font, color: grey }))
  return doc.save()
}
