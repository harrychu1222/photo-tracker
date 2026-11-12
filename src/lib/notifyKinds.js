// The things people can be told about. `who` says who can receive it; `push` is the default
// for the phone (the database uses the same defaults).
export const NOTIFY_KINDS = [
  { id: 'morning_summary', label: 'Morning summary (7am)', who: 'all', push: true },
  { id: 'task_blocked', label: 'A task is blocked', who: 'manager', push: true },
  { id: 'defect_urgent', label: 'An urgent defect is raised', who: 'manager', push: true },
  { id: 'task_done', label: 'A task is finished', who: 'manager', push: false },
  { id: 'defect_new', label: 'A defect is raised', who: 'manager', push: false },
  { id: 'issue_new', label: 'A site issue is logged', who: 'manager', push: false },
  { id: 'expense_new', label: 'An expense is added', who: 'manager', push: false },
  { id: 'task_assigned', label: 'A task is given to me', who: 'crew', push: true },
  { id: 'task_changed', label: 'My task is blocked or rescheduled', who: 'crew', push: true }
]

export const kindsFor = (isAdmin) => NOTIFY_KINDS.filter((k) => k.who === 'all' || k.who === (isAdmin ? 'manager' : 'crew'))
