export const STATUSES = [
  { value: 'todo', label: 'Not started', color: '#8598A6' },
  { value: 'progress', label: 'In progress', color: '#D98E1F' },
  { value: 'done', label: 'Complete', color: '#3E8E5D' },
  { value: 'blocked', label: 'Blocked', color: '#C0503E' }
]

export function statusMeta(value) {
  return STATUSES.find((s) => s.value === value) ?? STATUSES[0]
}
