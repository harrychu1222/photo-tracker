export const STATUSES = [
  { value: 'todo', label: 'Not started', color: '#8598A6' },
  { value: 'progress', label: 'In progress', color: '#D98E1F' },
  { value: 'done', label: 'Complete', color: '#3E8E5D' },
  { value: 'blocked', label: 'Blocked', color: '#C0503E' }
]

export function statusMeta(value) {
  return STATUSES.find((s) => s.value === value) ?? STATUSES[0]
}

export const QUOTING_STATUSES = [
  { value: 'pending_quotation', label: 'Pending quotation', color: '#8598A6' },
  { value: 'quoted', label: 'Quoted', color: '#3E6FD9' },
  { value: 'rejected', label: 'Rejected', color: '#C0503E' }
]

export function quotingStatusMeta(value) {
  return QUOTING_STATUSES.find((s) => s.value === value) ?? null
}
