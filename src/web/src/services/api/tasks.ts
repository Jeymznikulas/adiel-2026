import { apiRequest } from './client'

export type TaskStatus = 'To do' | 'In progress' | 'Completed'
export type TaskPriority = 'Low' | 'Medium' | 'High'
export type Subtask = {
  id: string
  title: string
  completed: boolean
  completedAt: string | null
  position: number
  createdAt: string
  updatedAt: string
  version: number
}
export type Task = {
  id: string
  title: string
  description: string
  status: TaskStatus
  priority: TaskPriority
  assignedToId: string | null
  assignedTo: string
  assignedBy: string
  dueDate: string | null
  dueTime: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  archivedAt: string | null
  version: number
  subtasks: Subtask[]
}
export type TaskPage = { items: Task[]; total: number }
export type CreateTask = Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignedToId' | 'assignedTo' | 'dueDate' | 'dueTime'>
export type SaveTask = Pick<Task, 'title' | 'description' | 'priority' | 'assignedToId' | 'assignedTo' | 'dueDate' | 'dueTime' | 'version'>

export const listTasks = (query: { search?: string; status?: TaskStatus; priority?: TaskPriority; includeArchived?: boolean; archivedOnly?: boolean } = {}) => {
  const parameters = new URLSearchParams()
  if (query.search) parameters.set('search', query.search)
  if (query.status) parameters.set('status', query.status)
  if (query.priority) parameters.set('priority', query.priority)
  if (query.includeArchived) parameters.set('includeArchived', 'true')
  if (query.archivedOnly) parameters.set('archivedOnly', 'true')
  return apiRequest<TaskPage>('/tasks?' + parameters.toString())
}
export const getTask = (id: string) => apiRequest<Task>('/tasks/' + id)
export const createTask = (task: CreateTask) => apiRequest<Task>('/tasks', { method: 'POST', body: JSON.stringify(task) })
export const updateTask = (id: string, task: SaveTask) => apiRequest<Task>('/tasks/' + id, { method: 'PUT', body: JSON.stringify(task) })
export const changeTaskStatus = (id: string, status: TaskStatus, version: number) => apiRequest<Task>('/tasks/' + id + '/status', { method: 'POST', body: JSON.stringify({ status, version }) })
export const archiveTask = (id: string, version: number) => apiRequest<Task>('/tasks/' + id + '/archive', { method: 'POST', body: JSON.stringify({ version }) })
export const restoreTask = (id: string, version: number) => apiRequest<Task>('/tasks/' + id + '/restore', { method: 'POST', body: JSON.stringify({ version }) })
export const addTaskSubtask = (taskId: string, title: string, taskVersion: number) => apiRequest<Task>('/tasks/' + taskId + '/subtasks', { method: 'POST', body: JSON.stringify({ title, taskVersion }) })
export const updateTaskSubtask = (taskId: string, subtaskId: string, title: string, version: number, taskVersion: number) => apiRequest<Task>('/tasks/' + taskId + '/subtasks/' + subtaskId, { method: 'PUT', body: JSON.stringify({ title, version, taskVersion }) })
export const setTaskSubtaskCompletion = (taskId: string, subtaskId: string, completed: boolean, version: number, taskVersion: number) => apiRequest<Task>('/tasks/' + taskId + '/subtasks/' + subtaskId + '/completion', { method: 'POST', body: JSON.stringify({ completed, version, taskVersion }) })
export const removeTaskSubtask = (taskId: string, subtaskId: string, version: number, taskVersion: number) => apiRequest<Task>('/tasks/' + taskId + '/subtasks/' + subtaskId, { method: 'DELETE', body: JSON.stringify({ version, taskVersion }) })
