import { useEffect, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useWork } from '../../context/WorkContext'
import { todayLocal } from '../../lib/tasks'
import { fmtMoney } from '../../lib/format'
import { materialCost, fmtQty } from '../../lib/costs'
import { EXPENSE_CATEGORIES, exGstFromEntered, parseAmount, incGst } from '../../lib/expenses'
import { materialStatusPatch } from '../../lib/materials'

const inputClass = 'w-full rounded-lg border border-ink-200 bg-white px-3 py-2 text-base focus:border-signal-500'

// Add or edit one expense. `expense` is null for a new one.
export default function ExpenseForm({ project, expense, onDone }) {
  const { isAdmin } = useAuth()
  const {
    tasksByProject,
    materialsByTask,
    roomsById,
    matPrices,
    addExpense,
    updateExpense,
    uploadReceipt,
    receiptUrl,
    removeReceipt,
    setMaterialStatus
  } = useWork()

  const [date, setDate] = useState(expense?.expense_date || todayLocal())
  const [supplier, setSupplier] = useState(expense?.supplier || '')
  const [description, setDescription] = useState(expense?.description || '')
  const [category, setCategory] = useState(expense?.category || 'materials')
  // Editing shows the stored ex-GST amount; the tick is for typing in a GST-inclusive price.
  const [amount, setAmount] = useState(expense ? String(expense.amount_ex_gst) : '')
  const [hasGst, setHasGst] = useState(false)
  const [materialId, setMaterialId] = useState(expense?.material_id || '')
  const [receiptPath, setReceiptPath] = useState(expense?.receipt_path || '')
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [askOrdered, setAskOrdered] = useState(null) // the material to offer "Mark as ordered?" for

  // The project's material lines, labelled by task and room.
  const lines = (tasksByProject[project.id] || []).flatMap((t) =>
    (materialsByTask[t.id] || []).map((m) => ({
      m,
      label: `${m.name} · ${fmtQty(m.quantity)} ${m.unit || ''} — ${t.name}${roomsById[t.room_id] ? ` (${roomsById[t.room_id].name})` : ''}`.replace(/\s+/g, ' ')
    }))
  )

  useEffect(() => {
    let live = true
    setReceiptPreview(null)
    if (receiptPath) receiptUrl(receiptPath).then((u) => live && setReceiptPreview(u)).catch(() => {})
    return () => {
      live = false
    }
  }, [receiptPath])

  function pickMaterial(id) {
    setMaterialId(id)
    const line = lines.find((l) => l.m.id === id)?.m
    // Admins can see the planned price, so start the amount from it (still editable).
    if (line && isAdmin && !amount) {
      const planned = materialCost(line, matPrices[line.id])
      if (planned != null) {
        setAmount(String(planned))
        setHasGst(false)
      }
    }
    if (line && !description.trim()) setDescription(line.name)
    if (line) setCategory('materials')
  }

  async function onReceipt(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const path = await uploadReceipt(file)
      if (receiptPath && receiptPath !== expense?.receipt_path) await removeReceipt(receiptPath)
      setReceiptPath(path)
    } catch (err) {
      setError(`Receipt upload failed: ${err.message}`)
    } finally {
      setBusy(false)
    }
  }

  async function save(e) {
    e.preventDefault()
    const typed = parseAmount(amount)
    if (!description.trim()) return setError('Add a short description.')
    if (typed == null) return setError('Enter the amount.')
    setBusy(true)
    setError(null)
    const fields = {
      expense_date: date || todayLocal(),
      supplier,
      description,
      category,
      amount_ex_gst: exGstFromEntered(typed, hasGst),
      material_id: materialId,
      receipt_path: receiptPath
    }
    try {
      if (expense) {
        await updateExpense(expense.id, fields)
        if (expense.receipt_path && expense.receipt_path !== receiptPath) await removeReceipt(expense.receipt_path)
      } else {
        await addExpense(project.id, fields)
      }
      const line = lines.find((l) => l.m.id === materialId)?.m
      if (line && (line.status || 'to_order') === 'to_order') setAskOrdered(line)
      else onDone()
    } catch (err) {
      setError(err.code === '42703' || err.code === '42P01' ? 'Run migration 9 first.' : err.message)
    } finally {
      setBusy(false)
    }
  }

  async function markOrdered() {
    setBusy(true)
    try {
      await setMaterialStatus(askOrdered.id, materialStatusPatch(askOrdered, 'ordered'))
      onDone()
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (askOrdered) {
    return (
      <div className="mb-4 rounded-xl border border-signal-500 bg-white p-4">
        <p className="text-sm font-semibold text-ink-900">Expense saved.</p>
        <p className="mt-1 text-sm text-ink-800">Mark “{askOrdered.name}” as ordered?</p>
        {error && <p className="mt-1 text-sm text-status-blocked">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button onClick={markOrdered} disabled={busy} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
            Yes, ordered
          </button>
          <button onClick={onDone} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600">
            No
          </button>
        </div>
      </div>
    )
  }

  const typed = parseAmount(amount)
  const exPreview = typed == null ? null : exGstFromEntered(typed, hasGst)

  return (
    <form onSubmit={save} className="mb-4 space-y-3 rounded-xl border border-ink-100 bg-ink-50 p-3">
      <p className="text-sm font-semibold text-ink-900">{expense ? 'Edit expense' : 'New expense'}</p>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-ink-600">
          Date
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} aria-label="Expense date" />
        </label>
        <label className="text-xs text-ink-600">
          Category
          <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass} aria-label="Category">
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Supplier (e.g. Bunnings)" className={inputClass} aria-label="Supplier" />
      <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?" className={inputClass} aria-label="Description" />

      {lines.length > 0 && (
        <label className="block text-xs text-ink-600">
          Paid for this material (optional)
          <select value={materialId} onChange={(e) => pickMaterial(e.target.value)} className={inputClass} aria-label="Material">
            <option value="">Not linked to a material</option>
            {lines.map((l) => (
              <option key={l.m.id} value={l.m.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <div>
        <input
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount ($)"
          className={inputClass}
          aria-label="Amount"
        />
        <label className="mt-1.5 flex items-center gap-2 text-sm text-ink-800">
          <input type="checkbox" checked={hasGst} onChange={(e) => setHasGst(e.target.checked)} className="h-4 w-4" />
          This amount includes GST
        </label>
        {exPreview != null && (
          <p className="mt-1 text-xs text-ink-600">
            Recorded as {fmtMoney(exPreview)} ex-GST ({fmtMoney(incGst(exPreview))} with GST). Use a minus sign for a refund.
          </p>
        )}
      </div>

      <div>
        {receiptPath ? (
          <div className="flex items-center gap-3">
            {receiptPreview ? (
              <a href={receiptPreview} target="_blank" rel="noreferrer">
                <img src={receiptPreview} alt="Receipt" className="h-16 w-16 rounded-lg object-cover" />
              </a>
            ) : (
              <span className="text-xs text-ink-600">Receipt attached</span>
            )}
            <button
              type="button"
              onClick={() => setReceiptPath('')}
              className="text-xs font-medium text-status-blocked"
            >
              Remove receipt
            </button>
          </div>
        ) : (
          <div className="flex gap-2">
            <label className="cursor-pointer rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800">
              Take receipt photo
              <input type="file" accept="image/*" capture="environment" onChange={onReceipt} className="hidden" aria-label="Take receipt photo" />
            </label>
            <label className="cursor-pointer rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-800">
              Choose photo
              <input type="file" accept="image/*" onChange={onReceipt} className="hidden" aria-label="Choose receipt photo" />
            </label>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-status-blocked">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
          {expense ? 'Save changes' : 'Save expense'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-600">
          Cancel
        </button>
      </div>
    </form>
  )
}
