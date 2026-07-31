import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'

type TaskStatus = 'To do' | 'In progress' | 'Completed'
type TaskPriority = 'Low' | 'Medium' | 'High'
type TaskFilter = 'All' | TaskStatus
type DueDateFilter = 'All' | 'Overdue' | 'Due today' | 'Upcoming' | 'No due date'

type Task = {
  id: number
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignedTo: string
  assignedBy: string
  createdAt: string
  dueDate: string
}

type TasksPageProps = {
  currentUsername: string
}

const storageKey = 'adiel.tasks'
const statusFilters: TaskFilter[] = ['All', 'To do', 'In progress', 'Completed']
const statusGroups = [
  { status: 'To do' as const, accent: 'bg-sky-500', border: 'border-l-sky-500', soft: 'bg-sky-50', text: 'text-sky-700' },
  { status: 'In progress' as const, accent: 'bg-amber-500', border: 'border-l-amber-500', soft: 'bg-amber-50', text: 'text-amber-700' },
  { status: 'Completed' as const, accent: 'bg-emerald-500', border: 'border-l-emerald-500', soft: 'bg-emerald-50', text: 'text-emerald-700' },
]

const initialTasks: Task[] = [
  { id: 1, title: 'Review material requirements', description: 'Confirm quantities needed for upcoming site deliveries.', status: 'To do', priority: 'High', assignedTo: 'Alex Morgan', assignedBy: 'Operations', createdAt: '2026-07-31', dueDate: '2026-08-03' },
  { id: 2, title: 'Prepare client quotation', description: 'Complete the pricing breakdown and commercial terms.', status: 'In progress', priority: 'Medium', assignedTo: 'Jamie Lee', assignedBy: 'Sales Team', createdAt: '2026-07-31', dueDate: '2026-08-01' },
  { id: 3, title: 'Update supplier directory', description: 'Verify contact details for active material suppliers.', status: 'Completed', priority: 'Low', assignedTo: 'Taylor Cruz', assignedBy: 'Operations', createdAt: '2026-07-30', dueDate: '2026-07-30' },
]

const emptyDraft = {
  title: '',
  description: '',
  status: 'To do' as TaskStatus,
  priority: 'Medium' as TaskPriority,
  assignedTo: '',
  dueDate: '',
}

function loadTasks() {
  try {
    const savedTasks = window.localStorage.getItem(storageKey)
    if (!savedTasks) return initialTasks
    return (JSON.parse(savedTasks) as Task[]).map((task) => ({ ...task, dueDate: task.dueDate ?? '' }))
  } catch {
    return initialTasks
  }
}

function initials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'UN'
}

function formatDate(value: string) {
  if (!value) return 'No date'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00`))
}

function dueDateClass(task: Task) {
  if (!task.dueDate) return 'text-slate-400'
  if (task.status === 'Completed') return 'text-emerald-600'
  const today = new Date().toISOString().slice(0, 10)
  if (task.dueDate < today) return 'text-red-600'
  if (task.dueDate === today) return 'text-amber-600'
  return 'text-slate-600'
}

function dateKey(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function TasksCalendar({ tasks, onTaskSelect }: { tasks: Task[]; onTaskSelect: (task: Task) => void }) {
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const todayKey = dateKey(new Date())
  const monthLabel = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(visibleMonth)
  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstWeekday = new Date(year, month, 1).getDay()
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(year, month, index - firstWeekday + 1)
      return { date, key: dateKey(date), isCurrentMonth: date.getMonth() === month }
    })
  }, [visibleMonth])

  function changeMonth(offset: number) {
    setVisibleMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  function goToToday() {
    const today = new Date()
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
  }

  return (
    <div className="animate-[view-swap_340ms_cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity]">
      <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Monthly schedule</p><h3 className="mt-1 text-xl font-bold tracking-[-0.03em] text-brand-blue">{monthLabel}</h3></div>
        <div className="flex items-center gap-2">
          <button className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50" type="button" onClick={goToToday}>Today</button>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            <button className="grid size-9 place-items-center text-slate-500 transition hover:bg-slate-50 hover:text-brand-blue" type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>
            <button className="grid size-9 place-items-center border-l border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-brand-blue" type="button" onClick={() => changeMonth(1)} aria-label="Next month"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day) => <div className="px-3 py-3 text-center text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500" key={day}>{day}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dayTasks = tasks.filter((task) => task.dueDate === day.key)
              const isToday = day.key === todayKey
              return (
                <div className={`min-h-36 border-b border-r border-slate-100 p-2.5 ${day.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50'}`} key={day.key}>
                  <div className={`grid size-7 place-items-center rounded-lg text-xs font-bold ${isToday ? 'bg-brand-blue text-white shadow-sm' : day.isCurrentMonth ? 'text-slate-600' : 'text-slate-300'}`}>{day.date.getDate()}</div>
                  <div className="mt-2 space-y-1.5">
                    {dayTasks.slice(0, 3).map((task) => {
                      const style = task.status === 'Completed' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : task.status === 'In progress' ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'
                      return <button className={`block w-full rounded-lg border px-2 py-1.5 text-left transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-blue ${style}`} type="button" key={task.id} title={`${task.title} — ${task.assignedTo}`} onClick={() => onTaskSelect(task)}><span className="block truncate text-[11px] font-bold">{task.title}</span><span className="mt-0.5 block truncate text-[10px] opacity-70">{task.assignedTo}</span></button>
                    })}
                    {dayTasks.length > 3 ? <p className="px-1 text-[11px] font-bold text-slate-400">+{dayTasks.length - 3} more</p> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-5 py-3 text-xs font-semibold text-slate-500">
        {statusGroups.map((group) => <span className="flex items-center gap-2" key={group.status}><span className={`size-2 rounded-full ${group.accent}`} />{group.status}</span>)}
      </div>
    </div>
  )
}

export function TasksPage({ currentUsername }: TasksPageProps) {
  const [tasks, setTasks] = useState<Task[]>(loadTasks)
  const [activeFilter, setActiveFilter] = useState<TaskFilter>('All')
  const [activeView, setActiveView] = useState<'Table' | 'Calendar'>('Table')
  const [searchQuery, setSearchQuery] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [assigneeFilter, setAssigneeFilter] = useState('All')
  const [priorityFilter, setPriorityFilter] = useState<'All' | TaskPriority>('All')
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>('All')
  const [isAddingTask, setIsAddingTask] = useState(false)
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null)
  const [isEditingTask, setIsEditingTask] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<TaskStatus>>(() => new Set())
  const [draft, setDraft] = useState(emptyDraft)
  const [editDraft, setEditDraft] = useState(emptyDraft)
  const selectedTask = selectedTaskId === null ? null : tasks.find((task) => task.id === selectedTaskId) ?? null

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(tasks))
  }, [tasks])

  const summary = useMemo(() => ({
    total: tasks.length,
    inProgress: tasks.filter((task) => task.status === 'In progress').length,
    completed: tasks.filter((task) => task.status === 'Completed').length,
  }), [tasks])

  const assignees = useMemo(() => Array.from(new Set(tasks.map((task) => task.assignedTo))).sort(), [tasks])
  const activeAdvancedFilterCount = Number(assigneeFilter !== 'All') + Number(priorityFilter !== 'All') + Number(dueDateFilter !== 'All')

  const visibleTasks = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const today = new Date().toISOString().slice(0, 10)
    return tasks.filter((task) => {
      const matchesStatus = activeFilter === 'All' || task.status === activeFilter
      const matchesAssignee = assigneeFilter === 'All' || task.assignedTo === assigneeFilter
      const matchesPriority = priorityFilter === 'All' || task.priority === priorityFilter
      const matchesDueDate = dueDateFilter === 'All'
        || (dueDateFilter === 'Overdue' && Boolean(task.dueDate && task.dueDate < today && task.status !== 'Completed'))
        || (dueDateFilter === 'Due today' && task.dueDate === today)
        || (dueDateFilter === 'Upcoming' && task.dueDate > today)
        || (dueDateFilter === 'No due date' && !task.dueDate)
      const matchesSearch = !query || [task.title, task.description, task.assignedTo, task.assignedBy].some((value) => value.toLowerCase().includes(query))
      return matchesStatus && matchesAssignee && matchesPriority && matchesDueDate && matchesSearch
    })
  }, [activeFilter, assigneeFilter, dueDateFilter, priorityFilter, searchQuery, tasks])

  function clearAdvancedFilters() {
    setAssigneeFilter('All')
    setPriorityFilter('All')
    setDueDateFilter('All')
  }

  const visibleGroups = statusGroups.filter((group) => activeFilter === 'All' || group.status === activeFilter)

  function openTaskDialog(status: TaskStatus = 'To do') {
    setDraft({ ...emptyDraft, status })
    setIsAddingTask(true)
  }

  function openTaskDetails(task: Task) {
    setSelectedTaskId(task.id)
    setIsEditingTask(false)
    setIsConfirmingDelete(false)
  }

  function closeTaskDetails() {
    setSelectedTaskId(null)
    setIsEditingTask(false)
    setIsConfirmingDelete(false)
  }

  function beginEditingTask() {
    if (!selectedTask) return
    setEditDraft({
      title: selectedTask.title,
      description: selectedTask.description,
      status: selectedTask.status,
      priority: selectedTask.priority,
      assignedTo: selectedTask.assignedTo,
      dueDate: selectedTask.dueDate,
    })
    setIsEditingTask(true)
  }

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTask || !editDraft.title.trim() || !editDraft.assignedTo.trim() || !editDraft.dueDate) return
    setTasks((current) => current.map((task) => task.id === selectedTask.id ? {
      ...task,
      title: editDraft.title.trim(),
      description: editDraft.description.trim(),
      status: editDraft.status,
      priority: editDraft.priority,
      assignedTo: editDraft.assignedTo.trim(),
      dueDate: editDraft.dueDate,
    } : task))
    setIsEditingTask(false)
  }

  function removeSelectedTask() {
    if (!selectedTask) return
    setTasks((current) => current.filter((task) => task.id !== selectedTask.id))
    closeTaskDetails()
  }

  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const title = draft.title.trim()
    const assignedTo = draft.assignedTo.trim()
    if (!title || !assignedTo || !draft.dueDate) return

    setTasks((current) => [{
      id: Date.now(), title, description: draft.description.trim(), status: draft.status,
      priority: draft.priority, assignedTo, assignedBy: currentUsername,
      createdAt: new Date().toISOString().slice(0, 10), dueDate: draft.dueDate,
    }, ...current])
    setIsAddingTask(false)
  }

  function updateTask(id: number, changes: Partial<Pick<Task, 'status' | 'priority' | 'dueDate'>>) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, ...changes } : task))
  }

  function toggleGroup(status: TaskStatus) {
    setCollapsedGroups((current) => {
      const next = new Set(current)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  const summaryCards = [
    { label: 'Total tasks', value: summary.total, dot: 'bg-brand-blue', valueColor: 'text-brand-blue' },
    { label: 'In progress', value: summary.inProgress, dot: 'bg-amber-500', valueColor: 'text-amber-600' },
    { label: 'Completed', value: summary.completed, dot: 'bg-emerald-500', valueColor: 'text-emerald-600' },
  ]

  return (
    <div className="space-y-5 animate-[content-enter_360ms_cubic-bezier(0.22,1,0.36,1)]">
      <section className="grid gap-5 rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-[0_14px_45px_-28px_rgba(0,20,76,0.3)] sm:p-6 xl:grid-cols-[1fr_auto] xl:items-center">
        <div>
          <div className="flex items-center gap-2"><span className="h-px w-6 bg-brand-orange" /><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-brand-orange">Task management</p></div>
          <h2 className="mt-3 text-2xl font-bold tracking-[-0.04em] text-brand-blue sm:text-3xl">Workboard</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">Plan, assign, and monitor work in one structured view.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {summaryCards.map((card) => (
            <article className="min-w-0 rounded-2xl border border-slate-200/80 bg-slate-50/60 px-3 py-3.5 sm:min-w-32 sm:px-4" key={card.label}>
              <div className="flex items-center gap-2"><span className={`size-1.5 rounded-full ${card.dot}`} /><p className="truncate text-[11px] font-bold uppercase tracking-[0.06em] text-slate-500">{card.label}</p></div>
              <p className={`mt-2 text-2xl font-bold tracking-[-0.04em] ${card.valueColor}`}>{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-[1.5rem] border border-slate-200/80 bg-white shadow-[0_14px_45px_-30px_rgba(0,20,76,0.28)]">
        <div className="border-b border-slate-100 p-4 sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:max-w-xs">
                <svg className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                <input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-4 text-sm font-medium text-brand-blue outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-brand-blue/40 focus:bg-white focus:ring-4 focus:ring-brand-blue/[0.05]" type="search" placeholder="Search this board..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} aria-label="Search tasks" />
              </div>
              <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Filter tasks by status">
                {statusFilters.map((filter) => {
                  const count = filter === 'All' ? tasks.length : tasks.filter((task) => task.status === filter).length
                  return <button className={`shrink-0 rounded-lg px-3 py-2.5 text-xs font-bold transition ${activeFilter === filter ? 'bg-brand-blue text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`} type="button" key={filter} onClick={() => setActiveFilter(filter)} aria-pressed={activeFilter === filter}>{filter}<span className={`ml-1.5 ${activeFilter === filter ? 'text-white/60' : 'text-slate-400'}`}>{count}</span></button>
                })}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button className={`inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition ${isFilterOpen || activeAdvancedFilterCount ? 'border-brand-blue/20 bg-brand-blue/[0.05] text-brand-blue' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`} type="button" onClick={() => setIsFilterOpen((current) => !current)} aria-expanded={isFilterOpen}>
                <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16l-6 7v5l-4 2v-7L4 5Z" /></svg>
                Filter
                {activeAdvancedFilterCount ? <span className="grid size-5 place-items-center rounded-full bg-brand-blue text-[10px] text-white">{activeAdvancedFilterCount}</span> : null}
              </button>
              <div className="relative grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1" role="group" aria-label="Task view">
                <span className={`pointer-events-none absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-brand-blue shadow-[0_5px_14px_-6px_rgba(0,20,76,0.7)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${activeView === 'Calendar' ? 'translate-x-full' : 'translate-x-0'}`} aria-hidden="true" />
                <button className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors duration-300 ${activeView === 'Table' ? 'text-white' : 'text-slate-500 hover:text-brand-blue'}`} type="button" onClick={() => setActiveView('Table')} aria-pressed={activeView === 'Table'}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 5h16M4 12h16M4 19h16" /></svg>Table</button>
                <button className={`relative z-10 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors duration-300 ${activeView === 'Calendar' ? 'text-white' : 'text-slate-500 hover:text-brand-blue'}`} type="button" onClick={() => setActiveView('Calendar')} aria-pressed={activeView === 'Calendar'}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 2v3M17 2v3M3 9h18M5 4h14a2 2 0 0 1 2 2v15H3V6a2 2 0 0 1 2-2Z" /></svg>Calendar</button>
              </div>
              <button className="group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-4 text-xs font-bold text-white shadow-[0_10px_24px_-10px_rgba(0,20,76,0.65)] transition-all hover:-translate-y-0.5 sm:flex-none" type="button" onClick={() => openTaskDialog()}><svg className="size-4 transition-transform group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>Add task</button>
            </div>
          </div>

          {isFilterOpen ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 animate-[content-enter_180ms_ease-out]">
              <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-bold text-brand-blue">Advanced filters</p><p className="mt-0.5 text-[11px] text-slate-400">Combine filters to narrow this workboard.</p></div><button className="text-xs font-bold text-slate-400 transition hover:text-brand-orange disabled:cursor-not-allowed disabled:opacity-40" type="button" onClick={clearAdvancedFilters} disabled={!activeAdvancedFilterCount}>Clear all</button></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div><label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="filter-assignee">Assignee</label><select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="filter-assignee" value={assigneeFilter} onChange={(event) => setAssigneeFilter(event.target.value)}><option>All</option>{assignees.map((assignee) => <option key={assignee}>{assignee}</option>)}</select></div>
                <div><label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="filter-priority">Priority</label><select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="filter-priority" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as 'All' | TaskPriority)}><option>All</option><option>Low</option><option>Medium</option><option>High</option></select></div>
                <div><label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500" htmlFor="filter-due-date">Due date</label><select className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="filter-due-date" value={dueDateFilter} onChange={(event) => setDueDateFilter(event.target.value as DueDateFilter)}><option>All</option><option>Overdue</option><option>Due today</option><option>Upcoming</option><option>No due date</option></select></div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-200/70 pt-3 text-[11px] font-semibold text-slate-400"><span>Results update automatically</span><span className="text-brand-blue">{visibleTasks.length} of {tasks.length} tasks</span></div>
            </div>
          ) : null}
        </div>

        {activeView === 'Calendar' ? <TasksCalendar tasks={visibleTasks} onTaskSelect={openTaskDetails} /> : visibleTasks.length ? (
          <div className="overflow-x-auto animate-[view-swap_340ms_cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity]">
            <table className="w-full min-w-[1120px] table-fixed border-collapse text-left">
              <caption className="sr-only">Tasks grouped by status</caption>
              <colgroup><col className="w-[31%]" /><col className="w-[15%]" /><col className="w-[13%]" /><col className="w-[10%]" /><col className="w-[14%]" /><col className="w-[13%]" /><col className="w-[4%]" /></colgroup>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                  <th className="px-5 py-3.5 font-bold">Task</th><th className="px-4 py-3.5 font-bold">Assignee</th><th className="px-4 py-3.5 font-bold">Status</th><th className="px-4 py-3.5 font-bold">Priority</th><th className="px-4 py-3.5 font-bold">Due date</th><th className="px-4 py-3.5 font-bold">Assigned by</th><th className="px-2 py-3.5"><span className="sr-only">Complete</span></th>
                </tr>
              </thead>
              {visibleGroups.map((group) => {
                const groupTasks = visibleTasks.filter((task) => task.status === group.status)
                const isCollapsed = collapsedGroups.has(group.status)
                return (
                  <tbody key={group.status}>
                    <tr className="border-y border-slate-100 bg-white">
                      <td colSpan={7} className="px-4 py-3">
                        <button className="group inline-flex items-center gap-2 text-left" type="button" onClick={() => toggleGroup(group.status)} aria-expanded={!isCollapsed}>
                          <svg className={`size-3.5 text-slate-300 transition-transform ${isCollapsed ? '-rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
                          <span className={`size-2 rounded-full ${group.accent}`} />
                          <span className={`text-sm font-extrabold ${group.text}`}>{group.status}</span>
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">{groupTasks.length}</span>
                        </button>
                      </td>
                    </tr>
                    {!isCollapsed ? groupTasks.map((task) => {
                      const statusStyle = task.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : task.status === 'In progress' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
                      const priorityStyle = task.priority === 'High' ? 'bg-red-50 text-red-600' : task.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'
                      const isOverdue = Boolean(task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10) && task.status !== 'Completed')
                      return (
                        <tr className="group border-b border-slate-100 transition-colors hover:bg-[#fbfcfe]" key={task.id}>
                          <td className={`border-l-4 ${group.border} px-4 py-3.5`}>
                            <div className="flex min-w-0 items-start gap-3">
                              <button className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border transition ${task.status === 'Completed' ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-200 text-transparent hover:border-brand-blue/40 hover:text-brand-blue/30'}`} type="button" onClick={() => updateTask(task.id, { status: task.status === 'Completed' ? 'To do' : 'Completed' })} aria-label={task.status === 'Completed' ? `Reopen ${task.title}` : `Complete ${task.title}`}><svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg></button>
                              <div className="min-w-0"><button className={`block max-w-full truncate text-left text-sm font-bold transition hover:text-brand-orange focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue ${task.status === 'Completed' ? 'text-slate-400 line-through' : 'text-brand-blue'}`} type="button" onClick={() => openTaskDetails(task)}>{task.title}</button><p className="mt-1 truncate text-xs leading-5 text-slate-500">{task.description || 'No description'}</p></div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5"><div className="flex items-center gap-2"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[linear-gradient(145deg,#092968,#00113f)] text-[10px] font-bold text-white">{initials(task.assignedTo)}</span><span className="truncate text-xs font-semibold text-slate-700">{task.assignedTo}</span></div></td>
                          <td className="px-4 py-3.5"><div className={`relative rounded-lg ${statusStyle}`}><select className="h-9 w-full cursor-pointer appearance-none bg-transparent px-2.5 pr-6 text-[11px] font-bold uppercase tracking-wide outline-none" value={task.status} onChange={(event) => updateTask(task.id, { status: event.target.value as TaskStatus })} aria-label={`Status for ${task.title}`}><option>To do</option><option>In progress</option><option>Completed</option></select><svg className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></div></td>
                          <td className="px-4 py-3.5"><div className={`relative rounded-lg ${priorityStyle}`}><select className="h-9 w-full cursor-pointer appearance-none bg-transparent px-2.5 pr-6 text-[11px] font-bold uppercase tracking-wide outline-none" value={task.priority} onChange={(event) => updateTask(task.id, { priority: event.target.value as TaskPriority })} aria-label={`Priority for ${task.title}`}><option>Low</option><option>Medium</option><option>High</option></select><svg className="pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg></div></td>
                          <td className="px-4 py-3.5"><div className="relative"><input className={`h-9 w-full rounded-lg border border-transparent bg-slate-50 px-2 text-xs font-semibold outline-none transition hover:border-slate-200 focus:border-brand-blue/30 focus:bg-white ${dueDateClass(task)}`} type="date" value={task.dueDate} onChange={(event) => updateTask(task.id, { dueDate: event.target.value })} aria-label={`Due date for ${task.title}`} title={isOverdue ? `Overdue: ${formatDate(task.dueDate)}` : formatDate(task.dueDate)} />{isOverdue ? <span className="absolute -right-1 -top-1 size-2 rounded-full border-2 border-white bg-red-500" aria-label="Overdue" /> : null}</div></td>
                          <td className="px-4 py-3.5"><span className="block truncate text-xs font-semibold text-slate-600">{task.assignedBy}</span><span className="mt-1 block text-[10px] text-slate-400">{formatDate(task.createdAt)}</span></td>
                          <td className="px-2 py-3.5 text-center"><button className="grid size-8 place-items-center rounded-lg text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-brand-blue group-hover:opacity-100 focus:opacity-100" type="button" onClick={() => openTaskDetails(task)} aria-label={`View details for ${task.title}`}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg></button></td>
                        </tr>
                      )
                    }) : null}
                    {!isCollapsed ? <tr className="border-b border-slate-100"><td className={`border-l-4 ${group.border} px-4 py-2.5`} colSpan={7}><button className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-brand-blue" type="button" onClick={() => openTaskDialog(group.status)}><span className="text-lg font-light">+</span> Add item</button></td></tr> : null}
                  </tbody>
                )
              })}
            </table>
          </div>
        ) : (
          <div className="grid min-h-72 place-items-center p-8 text-center animate-[view-swap_340ms_cubic-bezier(0.22,1,0.36,1)] [will-change:transform,opacity]"><div><span className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-50 text-slate-300"><svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 11 12 14 22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg></span><h3 className="mt-4 text-sm font-bold text-brand-blue">No tasks found</h3><p className="mt-1 text-xs text-slate-400">Adjust your search or add a new task.</p><button className="mt-4 rounded-xl bg-brand-blue px-4 py-2 text-[10px] font-bold text-white" type="button" onClick={() => openTaskDialog()}>Add task</button></div></div>
        )}
      </section>

      {selectedTask ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="task-details-title">
          <button className="absolute inset-0" type="button" onClick={closeTaskDetails} aria-label="Close task details" />
          <section className="relative my-6 w-full max-w-2xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.3)]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-orange">Task details</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="task-details-title">{isEditingTask ? 'Edit task' : selectedTask.title}</h2></div>
              <button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={closeTaskDetails} aria-label="Close details"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
            </div>

            {isEditingTask ? (
              <form className="[&_input]:!text-sm [&_label]:!text-[11px] [&_select]:!text-sm [&_textarea]:!text-sm" onSubmit={saveTask}>
                <div className="space-y-4 px-6 py-5">
                  <div><label className="mb-2 block font-bold uppercase tracking-wider text-slate-500" htmlFor="edit-task-title">Task title</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 font-medium text-brand-blue outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="edit-task-title" value={editDraft.title} onChange={(event) => setEditDraft((current) => ({ ...current, title: event.target.value }))} required autoFocus /></div>
                  <div><label className="mb-2 block font-bold uppercase tracking-wider text-slate-500" htmlFor="edit-task-description">Description</label><textarea className="min-h-28 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 leading-6 text-brand-blue outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="edit-task-description" value={editDraft.description} onChange={(event) => setEditDraft((current) => ({ ...current, description: event.target.value }))} /></div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="mb-2 block font-bold uppercase tracking-wider text-slate-500" htmlFor="edit-task-status">Status</label><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="edit-task-status" value={editDraft.status} onChange={(event) => setEditDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))}><option>To do</option><option>In progress</option><option>Completed</option></select></div>
                    <div><label className="mb-2 block font-bold uppercase tracking-wider text-slate-500" htmlFor="edit-task-priority">Priority</label><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="edit-task-priority" value={editDraft.priority} onChange={(event) => setEditDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))}><option>Low</option><option>Medium</option><option>High</option></select></div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div><label className="mb-2 block font-bold uppercase tracking-wider text-slate-500" htmlFor="edit-task-assignee">Assigned to</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 font-medium text-brand-blue outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="edit-task-assignee" value={editDraft.assignedTo} onChange={(event) => setEditDraft((current) => ({ ...current, assignedTo: event.target.value }))} required /></div>
                    <div><label className="mb-2 block font-bold uppercase tracking-wider text-slate-500" htmlFor="edit-task-due-date">Due date</label><input className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-semibold text-slate-600 outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="edit-task-due-date" type="date" value={editDraft.dueDate} onChange={(event) => setEditDraft((current) => ({ ...current, dueDate: event.target.value }))} required /></div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={() => setIsEditingTask(false)}>Cancel</button><button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit">Save changes</button></div>
              </form>
            ) : (
              <>
                <div className="space-y-6 px-6 py-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${selectedTask.status === 'Completed' ? 'bg-emerald-50 text-emerald-700' : selectedTask.status === 'In progress' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>{selectedTask.status}</span>
                    <span className={`rounded-lg px-3 py-1.5 text-xs font-bold ${selectedTask.priority === 'High' ? 'bg-red-50 text-red-600' : selectedTask.priority === 'Medium' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>{selectedTask.priority} priority</span>
                  </div>
                  <div><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Description</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{selectedTask.description || 'No description provided.'}</p></div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><span className="grid size-10 place-items-center rounded-xl bg-brand-blue text-xs font-bold text-white">{initials(selectedTask.assignedTo)}</span><div><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned to</p><p className="mt-1 text-sm font-bold text-brand-blue">{selectedTask.assignedTo}</p></div></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Due date</p><p className={`mt-2 text-sm font-bold ${dueDateClass(selectedTask)}`}>{formatDate(selectedTask.dueDate)}</p></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned by</p><p className="mt-2 text-sm font-bold text-slate-600">{selectedTask.assignedBy}</p></div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Created</p><p className="mt-2 text-sm font-bold text-slate-600">{formatDate(selectedTask.createdAt)}</p></div>
                  </div>
                </div>
                <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
                  {isConfirmingDelete ? (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-red-700">Remove this task?</p><p className="mt-0.5 text-xs text-red-500">This action cannot be undone.</p></div><div className="flex gap-2"><button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 hover:bg-slate-100" type="button" onClick={() => setIsConfirmingDelete(false)}>Cancel</button><button className="h-10 rounded-xl bg-red-600 px-4 text-xs font-bold text-white shadow-sm hover:bg-red-700" type="button" onClick={removeSelectedTask}>Remove task</button></div></div>
                  ) : (
                    <div className="flex items-center justify-between gap-3"><button className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-red-500 transition hover:bg-red-50 hover:text-red-700" type="button" onClick={() => setIsConfirmingDelete(true)}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" /></svg>Remove</button><button className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand-blue px-5 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5" type="button" onClick={beginEditingTask}><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m4 16-1 5 5-1L19 9l-4-4L4 16Zm9-9 4 4" /></svg>Edit task</button></div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {isAddingTask ? (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm animate-[content-enter_180ms_ease-out]" role="dialog" aria-modal="true" aria-labelledby="add-task-title">
          <button className="absolute inset-0" type="button" onClick={() => setIsAddingTask(false)} aria-label="Close add task dialog" />
          <form className="relative my-6 w-full max-w-xl overflow-hidden rounded-[1.5rem] border border-white/20 bg-white shadow-[0_30px_90px_rgba(0,20,76,0.28)] [&_input]:!text-sm [&_label]:!text-[11px] [&_select]:!text-sm [&_textarea]:!text-sm" onSubmit={addTask}>
            <div className="border-b border-slate-100 px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-orange">New work item</p><h2 className="mt-1.5 text-xl font-bold tracking-[-0.03em] text-brand-blue" id="add-task-title">Add a task</h2><p className="mt-1 text-sm text-slate-500">Define the work, owner, and delivery date.</p></div>
                <button className="grid size-9 shrink-0 place-items-center rounded-xl text-slate-300 transition hover:bg-slate-100 hover:text-brand-blue" type="button" onClick={() => setIsAddingTask(false)} aria-label="Close dialog"><svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg></button>
              </div>
            </div>
            <div className="space-y-4 px-6 py-5">
              <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="task-title">Task title</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="task-title" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="What needs to be done?" autoFocus required /></div>
              <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="task-description">Description <span className="font-medium normal-case tracking-normal text-slate-300">(optional)</span></label><textarea className="min-h-24 w-full resize-y rounded-xl border border-slate-200 px-3.5 py-3 text-xs leading-5 text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="task-description" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Add useful context or instructions..." /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="task-status">Status</label><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="task-status" value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as TaskStatus }))}><option>To do</option><option>In progress</option><option>Completed</option></select></div>
                <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="task-priority">Priority</label><select className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 outline-none focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="task-priority" value={draft.priority} onChange={(event) => setDraft((current) => ({ ...current, priority: event.target.value as TaskPriority }))}><option>Low</option><option>Medium</option><option>High</option></select></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="task-assignee">Assigned to</label><input className="h-11 w-full rounded-xl border border-slate-200 px-3.5 text-xs font-medium text-brand-blue outline-none transition placeholder:text-slate-300 focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="task-assignee" value={draft.assignedTo} onChange={(event) => setDraft((current) => ({ ...current, assignedTo: event.target.value }))} placeholder="Assignee name" required /></div>
                <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="task-due-date">Due date</label><input className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-600 outline-none transition focus:border-brand-blue/40 focus:ring-4 focus:ring-brand-blue/[0.05]" id="task-due-date" type="date" min={new Date().toISOString().slice(0, 10)} value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} required /></div>
              </div>
              <div><label className="mb-2 block text-[10px] font-bold uppercase tracking-wider text-slate-500" htmlFor="task-assigner">Assigned by</label><input className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-xs font-medium text-slate-400" id="task-assigner" value={currentUsername} readOnly /></div>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <button className="h-10 rounded-xl px-4 text-xs font-bold text-slate-500 transition hover:bg-slate-100" type="button" onClick={() => setIsAddingTask(false)}>Cancel</button>
              <button className="h-10 rounded-xl bg-[linear-gradient(115deg,#00113f,#073078)] px-5 text-xs font-bold text-white shadow-[0_8px_20px_-10px_rgba(0,20,76,0.7)] transition hover:-translate-y-0.5" type="submit">Create task</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  )
}