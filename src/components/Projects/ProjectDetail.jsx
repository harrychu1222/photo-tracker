import { useState } from 'react'
import PhotoCard from '../Photos/PhotoCard'
import PhotoDetail from '../Photos/PhotoDetail'
import TasksTab from './TasksTab'
import MaterialsTab from './MaterialsTab'
import MeasurementsTab from './MeasurementsTab'
import ExpensesTab from './ExpensesTab'
import CashFlowTab from './CashFlowTab'
import TimeTab from './TimeTab'
import GanttTab from './GanttTab'
import { useWork } from '../../context/WorkContext'
import { projectStatusMeta } from '../../statusConfig'
import { fmtDateRange, fmtMoney } from '../../lib/format'
import { actualSpan } from '../../lib/quote'
import { fmtHours, taskProgress, todayLocal } from '../../lib/tasks'
import { sumCosts, taskCost } from '../../lib/costs'
import { projectMoney } from '../../lib/expenses'
import { receivedSummary } from '../../lib/cashflow'
import { labourCost, sumHours } from '../../lib/labour'
import { attentionItems, scheduleSummary } from '../../lib/attention'
import { taskPlannedSpan } from '../../lib/quote'
import Icon from '../ui/Icon'
import OverviewTab from './OverviewTab'

export default function ProjectDetail({
  project,
  finance,
  isAdmin,
  canEdit,
  photos,
  onBack,
  onEdit,
  onUpdatePhoto,
  onDeletePhoto,
  suggestions,
  projects,
  onCreateProject,
  isDesktop
}) {
  const [openPhoto, setOpenPhoto] = useState(null)
  const [tab, setTab] = useState('overview') // 'overview' | 'plan' | 'materials' | 'money' | 'photos'
  const [planTab, setPlanTab] = useState('tasks') // 'tasks' | 'gantt' | 'measurements'
  const [moneyTab, setMoneyTab] = useState(isAdmin ? 'cashflow' : 'expenses') // 'expenses' | 'time' | 'cashflow'
  const { tasksByProject, materialsByTask, equipmentByTask, matPrices, eqPrices, measurementsByProject, expensesByProject, paymentsByProject, timeByProject, rateBook, lumpsByProject } = useWork()
  const projectExpenses = expensesByProject[project.id] || []
  const measurementCount = (measurementsByProject[project.id] || []).length
  const projectTasks = tasksByProject[project.id] || []
  const taskCount = projectTasks.length
  const lineCount = projectTasks.reduce(
    (n, t) => n + (materialsByTask[t.id] || []).length + (equipmentByTask[t.id] || []).length,
    0
  )
  const planned = sumCosts(
    projectTasks.map((t) => taskCost(materialsByTask[t.id] || [], equipmentByTask[t.id] || [], matPrices, eqPrices))
  )
  const projectPayments = paymentsByProject[project.id] || []
  const projectTime = timeByProject[project.id] || []
  const labour = labourCost(projectTime, rateBook, lumpsByProject[project.id] || [])
  const money = projectMoney(finance, projectExpenses, planned.total, labour.hourly, labour.lumpTotal)
  const paid = receivedSummary(projectPayments, money.quote)
  const status = projectStatusMeta(project.status)
  const span = taskPlannedSpan(projectTasks)
  const dates = fmtDateRange(project.start_date, project.end_date)
  const actual = actualSpan(project, projectTasks)
  const actualDates = fmtDateRange(actual.start, actual.end)

  const today = todayLocal()
  const progress = taskProgress(projectTasks)
  const schedule = scheduleSummary(projectTasks, today)
  const everyMaterial = projectTasks.flatMap((t) => materialsByTask[t.id] || [])
  const attention = attentionItems({ tasks: projectTasks, materials: everyMaterial, money, progress, isAdmin, today })

  function go(nextTab, sub) {
    setTab(nextTab)
    if (nextTab === 'plan' && sub) setPlanTab(sub)
    if (nextTab === 'money' && sub) setMoneyTab(sub)
  }

  const topTabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'plan', label: 'Plan' },
    { id: 'materials', label: `Materials (${lineCount})` },
    { id: 'money', label: isAdmin ? 'Money' : 'Hours & expenses' },
    { id: 'photos', label: `Photos (${photos.length})` }
  ]
  const planTabs = [
    { id: 'tasks', label: `Tasks (${taskCount})` },
    { id: 'gantt', label: 'Gantt' },
    { id: 'measurements', label: `Measurements (${measurementCount})` }
  ]
  const moneyTabs = [
    { id: 'expenses', label: `Expenses (${projectExpenses.length})` },
    { id: 'time', label: isAdmin ? `Labour (${projectTime.length})` : `My hours (${projectTime.length})` },
    ...(isAdmin ? [{ id: 'cashflow', label: 'Cash flow' }] : [])
  ]
  if (isAdmin) moneyTabs.unshift(moneyTabs.pop())

  const chip = 'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold'

  return (
    <div className="px-4 py-4 md:px-10 md:py-6">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={onBack} className="flex min-h-[44px] items-center gap-1 text-sm font-medium text-ink-600">
          <Icon name="back" size={16} /> All projects
        </button>
        {canEdit && (
          <button onClick={onEdit} className="min-h-[44px] rounded-lg border border-ink-200 bg-white px-4 text-sm font-semibold text-ink-900">
            Edit
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-ink-900">{project.name}</h2>
        <span className={`${chip} bg-ink-100 text-ink-800`}>
          <span className="status-dot" style={{ backgroundColor: status.color }} />
          {status.label}
        </span>
        {progress.total > 0 && <span className={`${chip} bg-ink-100 text-ink-800`}>{progress.percent}% done</span>}
        {schedule.behindDays > 0 && (
          <span className={`${chip} bg-[#F6DAD4] text-[#7A2A1D]`}>
            {schedule.behindDays} day{schedule.behindDays === 1 ? '' : 's'} behind
          </span>
        )}
        {isAdmin && money.target != null && money.actual > 0 && (
          <span className={`${chip} ${money.vsTarget?.over ? 'bg-[#F6DAD4] text-[#7A2A1D]' : 'bg-ink-100 text-ink-800'}`}>
            {fmtMoney(money.actual)} of {fmtMoney(money.target)} spent
          </span>
        )}
      </div>

      <nav
        aria-label="Project sections"
        className={`mt-4 flex gap-1 overflow-x-auto ${isDesktop ? 'border-b border-ink-200' : 'pb-1'}`}
      >
        {topTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-current={tab === t.id ? 'page' : undefined}
            className={
              isDesktop
                ? `-mb-px min-h-[44px] whitespace-nowrap border-b-2 px-4 text-sm ${
                    tab === t.id ? 'border-signal-500 font-semibold text-ink-900' : 'border-transparent font-medium text-ink-600'
                  }`
                : `min-h-[44px] flex-none whitespace-nowrap rounded-full border px-4 text-sm font-semibold ${
                    tab === t.id ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200 bg-white text-ink-600'
                  }`
            }
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="mt-5">
        {(tab === 'plan' || tab === 'money') && (
          <div role="group" aria-label={tab === 'plan' ? 'Plan views' : 'Money views'} className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-ink-100 p-1 sm:inline-flex">
            {(tab === 'plan' ? planTabs : moneyTabs).map((t) => {
              const on = (tab === 'plan' ? planTab : moneyTab) === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => (tab === 'plan' ? setPlanTab(t.id) : setMoneyTab(t.id))}
                  aria-pressed={on}
                  className={`min-h-[40px] flex-1 whitespace-nowrap rounded-lg px-4 text-sm font-semibold ${
                    on ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
        )}

        {tab === 'overview' && (
          <OverviewTab
            project={project}
            isAdmin={isAdmin}
            money={money}
            paid={paid}
            progress={progress}
            schedule={schedule}
            attention={attention}
            labour={labour}
            hoursLogged={sumHours(projectTime)}
            photos={photos}
            dates={dates || fmtDateRange(span.start, span.end)}
            actualDates={actualDates}
            onGo={go}
            onOpenPhoto={setOpenPhoto}
          />
        )}
        {tab === 'plan' && planTab === 'tasks' && <TasksTab project={project} photos={photos} />}
        {tab === 'plan' && planTab === 'gantt' && <GanttTab project={project} />}
        {tab === 'plan' && planTab === 'measurements' && <MeasurementsTab project={project} />}
        {tab === 'materials' && <MaterialsTab project={project} finance={finance} />}
        {tab === 'money' && moneyTab === 'expenses' && <ExpensesTab project={project} />}
        {tab === 'money' && moneyTab === 'time' && <TimeTab project={project} />}
        {tab === 'money' && moneyTab === 'cashflow' && isAdmin && <CashFlowTab project={project} finance={finance} />}

        {tab === 'photos' &&
          (photos.length === 0 ? (
            <p className="rounded-xl border border-dashed border-ink-200 bg-white py-10 text-center text-sm text-ink-600">
              No photos linked to this project yet. Pick this project when you add photos.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
              {photos.map((photo) => (
                <PhotoCard key={photo.id} photo={photo} onOpen={setOpenPhoto} />
              ))}
            </div>
          ))}
      </div>

      {openPhoto && (
        <PhotoDetail
          photo={openPhoto}
          onClose={() => setOpenPhoto(null)}
          onUpdate={onUpdatePhoto}
          onDelete={onDeletePhoto}
          suggestions={suggestions}
          projects={projects}
          onCreateProject={onCreateProject}
        />
      )}
    </div>
  )
}
