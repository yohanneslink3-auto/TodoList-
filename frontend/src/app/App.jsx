import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useCreateCategoryMutation,
  useCreateTaskMutation,
  useDeleteCategoryMutation,
  useDeleteTaskMutation,
  useDismissNotificationMutation,
  useGetCategoriesQuery,
  useGetMeQuery,
  useGetNotificationsQuery,
  useGetStatisticsQuery,
  useGetTasksQuery,
  useLogoutMutation,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useUpdateCategoryMutation,
  useUpdateTaskMutation,
} from './services/api'
import { AuthScreen } from '../features/auth/AuthScreen'
import { CategoryDialog } from '../features/categories/CategoryDialog'
import { NotificationPopover } from '../features/notifications/NotificationPopover'
import { TaskDialog } from '../features/tasks/TaskDialog'
import { TaskRow } from '../features/tasks/TaskRow'
import './App.css'

const views = [
  { id: 'all', label: 'All tasks', icon: '▦' },
  { id: 'today', label: 'Today', icon: '◷' },
  { id: 'upcoming', label: 'Upcoming', icon: '▤' },
  { id: 'overdue', label: 'Overdue', icon: '!' },
  { id: 'completed', label: 'Completed', icon: '✓' },
]

function requestError(error) {
  return error?.data?.error || 'Something went wrong. Please try again.'
}

function getOrderLabel(sort, order) {
  if (sort === 'priority') return order === 'desc' ? 'Highest priority' : 'Lowest priority'
  if (sort === 'title') return order === 'desc' ? 'Z to A' : 'A to Z'
  if (sort === 'dueDate') return order === 'desc' ? 'Latest due first' : 'Soonest due first'
  if (sort === 'updatedAt') return order === 'desc' ? 'Recently updated' : 'Least recent'
  return order === 'desc' ? 'Newest first' : 'Oldest first'
}

function App() {
  const meQuery = useGetMeQuery()
  const [logout] = useLogoutMutation()
  const [view, setView] = useState('all')
  const [categoryView, setCategoryView] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [sort, setSort] = useState('createdAt')
  const [order, setOrder] = useState('desc')
  const [page, setPage] = useState(1)
  const [taskDialog, setTaskDialog] = useState(null)
  const [categoryDialog, setCategoryDialog] = useState(null)
  const [noticeOpen, setNoticeOpen] = useState(false)
  const notificationRef = useRef(null)
  const [theme, setTheme] = useState(() => localStorage.getItem('taskflow-theme') || 'light')

  const categoriesQuery = useGetCategoriesQuery(undefined, { skip: !meQuery.data })
  const statsQuery = useGetStatisticsQuery(undefined, { skip: !meQuery.data })
  const noticesQuery = useGetNotificationsQuery(undefined, { skip: !meQuery.data, pollingInterval: 30_000 })
  const [createTask, createTaskState] = useCreateTaskMutation()
  const [updateTask, updateTaskState] = useUpdateTaskMutation()
  const [deleteTask] = useDeleteTaskMutation()
  const [createCategory, createCategoryState] = useCreateCategoryMutation()
  const [updateCategory, updateCategoryState] = useUpdateCategoryMutation()
  const [deleteCategory] = useDeleteCategoryMutation()
  const [markRead] = useMarkNotificationReadMutation()
  const [markAllRead] = useMarkAllNotificationsReadMutation()
  const [dismissNotification] = useDismissNotificationMutation()

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(timer)
  }, [search])

  useEffect(() => {
    localStorage.setItem('taskflow-theme', theme)
  }, [theme])

  useEffect(() => {
    if (!noticeOpen) return undefined

    function closeOnOutsideClick(event) {
      if (!notificationRef.current?.contains(event.target)) setNoticeOpen(false)
    }

    function closeOnEscape(event) {
      if (event.key === 'Escape') setNoticeOpen(false)
    }

    document.addEventListener('pointerdown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [noticeOpen])

  const taskParams = useMemo(() => ({
    page,
    limit: 8,
    search: debouncedSearch,
    sort,
    order,
    ...(view === 'completed' ? { status: 'completed' } : statusFilter ? { status: statusFilter } : {}),
    ...(priorityFilter ? { priority: priorityFilter } : {}),
    ...(categoryView ? { category: categoryView } : {}),
    ...(view === 'today' ? { due: 'today' } : {}),
    ...(view === 'upcoming' ? { due: 'upcoming' } : {}),
    ...(view === 'overdue' ? { due: 'overdue' } : {}),
  }), [page, debouncedSearch, sort, order, view, statusFilter, priorityFilter, categoryView])
  const tasksQuery = useGetTasksQuery(taskParams, { skip: !meQuery.data })

  if (meQuery.isLoading) return <div className="app-loading"><span className="loading-mark">✓</span><span>Getting your space ready…</span></div>
  if (meQuery.error && meQuery.error.status !== 401) {
    return <main className="offline-page"><span className="brand-mark">!</span><h1>Can’t reach the app yet</h1><p>{requestError(meQuery.error)}</p><button className="primary-button" onClick={() => meQuery.refetch()} type="button">Try again</button></main>
  }
  if (!meQuery.data) return <AuthScreen />

  const categories = categoriesQuery.data || []
  const tasks = tasksQuery.data?.data || []
  const pagination = tasksQuery.data?.pagination
  const stats = statsQuery.data || {}
  const activeCategory = categories.find((item) => item._id === categoryView)
  const activeView = activeCategory?.name || views.find((item) => item.id === view)?.label || 'All tasks'

  async function saveTask(values) {
    try {
      if (taskDialog?._id) await updateTask({ id: taskDialog._id, ...values }).unwrap()
      else await createTask(values).unwrap()
      setTaskDialog(null)
    } catch {
      return
    }
  }

  async function saveCategory(values) {
    try {
      if (categoryDialog?._id) await updateCategory({ id: categoryDialog._id, ...values }).unwrap()
      else await createCategory(values).unwrap()
      setCategoryDialog(null)
    } catch {
      return
    }
  }

  async function removeTask(task) {
    if (!window.confirm(`Delete “${task.title}”? This can’t be undone.`)) return
    try {
      await deleteTask(task._id).unwrap()
    } catch (error) {
      window.alert(requestError(error))
    }
  }

  async function removeCategory(category) {
    if (!window.confirm(`Delete “${category.name}”? Existing tasks will become uncategorized.`)) return
    try {
      await deleteCategory(category._id).unwrap()
      if (categoryView === category._id) setCategoryView('')
    } catch (error) {
      window.alert(requestError(error))
    }
  }

  async function toggleTask(task) {
    try {
      await updateTask({ id: task._id, status: task.status === 'completed' ? 'todo' : 'completed' }).unwrap()
    } catch (error) {
      window.alert(requestError(error))
    }
  }

  async function signOut() {
    try {
      await logout().unwrap()
      meQuery.refetch()
    } catch (error) {
      window.alert(requestError(error))
    }
  }

  async function dismissNotice(id) {
    try {
      await dismissNotification(id).unwrap()
    } catch (error) {
      window.alert(requestError(error))
    }
  }

  function chooseView(id) {
    setPage(1)
    setView(id)
    setCategoryView('')
    setStatusFilter('')
  }

  const taskError = createTaskState.error || updateTaskState.error
  const taskSaving = createTaskState.isLoading || updateTaskState.isLoading

  return (
    <div className={`app-shell theme-${theme}`}>
      <aside className="sidebar">
        <a aria-label="Taskflow home" className="brand" href="/">
          <span className="brand-mark">✓</span><span>task<span className="brand-light">flow</span></span>
        </a>
        <div className="workspace-switch"><span className="workspace-avatar">{meQuery.data.name.charAt(0).toUpperCase()}</span><span className="workspace-name"><strong>{meQuery.data.name}&apos;s space</strong><small>Personal workspace</small></span><span className="switch-chevron">⌄</span></div>
        <button className="primary-button new-task-button" onClick={() => setTaskDialog({})} type="button"><span>＋</span> New task <kbd>N</kbd></button>
        <nav aria-label="Main navigation" className="main-nav">
          <p className="nav-label">WORKSPACE</p>
          {views.map((item) => <button className={`nav-item ${!categoryView && view === item.id ? 'selected' : ''}`} key={item.id} onClick={() => chooseView(item.id)} type="button"><span className="nav-icon">{item.icon}</span>{item.label}{item.id === 'today' && stats.dueToday > 0 && <span className="nav-count">{stats.dueToday}</span>}</button>)}
          <div className="nav-section-heading"><p className="nav-label">YOUR CATEGORIES</p><button aria-label="Add category" className="mini-add" onClick={() => setCategoryDialog({})} type="button">＋</button></div>
          {categories.map((category) => <div className={`category-nav-row ${categoryView === category._id ? 'selected' : ''}`} key={category._id}><button className="category-nav" onClick={() => { setPage(1); setCategoryView(category._id); setView('all') }} type="button"><span className="category-dot" style={{ '--category-color': category.color }} />{category.name}</button><span className="category-actions"><button aria-label={`Edit ${category.name}`} onClick={() => setCategoryDialog(category)} type="button">✎</button><button aria-label={`Delete ${category.name}`} onClick={() => removeCategory(category)} type="button">×</button></span></div>)}
          <button className={`category-nav uncategorized-nav ${categoryView === 'uncategorized' ? 'selected' : ''}`} onClick={() => { setPage(1); setCategoryView('uncategorized'); setView('all') }} type="button"><span className="category-dot" style={{ '--category-color': '#a7aaba' }} />Uncategorized</button>
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-tip"><span>✦</span><strong>A gentle reminder</strong><p>Small progress is still progress. Keep going.</p></div>
          <button className="profile-button" onClick={signOut} type="button"><span className="profile-avatar">{meQuery.data.name.charAt(0).toUpperCase()}</span><span><strong>{meQuery.data.name}</strong><small>Sign out</small></span><span className="profile-menu">↗</span></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><b>/</b><strong>{activeView}</strong></div>
          <div className="topbar-actions">
            <label className="search-box"><span>⌕</span><input aria-label="Search tasks" onChange={(event) => { setPage(1); setSearch(event.target.value) }} placeholder="Search tasks…" value={search} /></label>
            <div className="notification-anchor" ref={notificationRef}><button aria-expanded={noticeOpen} aria-label={`Notifications${noticesQuery.data?.unreadCount ? `, ${noticesQuery.data.unreadCount} unread` : ''}`} className="icon-button notification-button" onClick={() => setNoticeOpen(!noticeOpen)} type="button"><svg aria-hidden="true" fill="none" height="17" viewBox="0 0 24 24" width="17"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" /></svg>{noticesQuery.data?.unreadCount > 0 && <span className="notification-badge">{noticesQuery.data.unreadCount > 9 ? '9+' : noticesQuery.data.unreadCount}</span>}</button>{noticeOpen && <NotificationPopover data={noticesQuery.data} onClose={() => setNoticeOpen(false)} onDismiss={dismissNotice} onRead={(id) => markRead(id)} onReadAll={() => markAllRead()} />}</div>
            <button aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} className="icon-button theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} type="button">{theme === 'light' ? '☾' : '☀'}</button>
            <button aria-label="User profile" className="top-avatar" title={meQuery.data.email} type="button">{meQuery.data.name.charAt(0).toUpperCase()}</button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="greeting">
            <div><p className="eyebrow">YOUR PERSONAL SPACE</p><h1>{view === 'today' ? 'Your day, in focus.' : `Welcome back, ${meQuery.data.name.split(' ')[0]}.`}</h1><p>Here&apos;s a little space to make progress on what matters.</p></div>
            <button className="primary-button header-create" onClick={() => setTaskDialog({})} type="button"><span>＋</span> Add a task</button>
          </section>

          <section aria-label="Task statistics" className="stats-grid">
            <article className="stat-card stat-total"><span className="stat-icon">▦</span><div><small>Total tasks</small><strong>{stats.total ?? '—'}</strong></div><span className="stat-foot">in your workspace</span></article>
            <article className="stat-card stat-complete"><span className="stat-icon">✓</span><div><small>Completed</small><strong>{stats.completionRate ?? 0}<em>%</em></strong></div><span className="stat-foot">{stats.completed || 0} tasks finished</span></article>
            <article className="stat-card stat-overdue"><span className="stat-icon">◷</span><div><small>Overdue</small><strong>{stats.overdue ?? '—'}</strong></div><span className="stat-foot">needs a little attention</span></article>
            <article className="stat-card stat-today"><span className="stat-icon">✦</span><div><small>Due today</small><strong>{stats.dueToday ?? '—'}</strong></div><span className="stat-foot">one step at a time</span></article>
          </section>

          <section className="task-section">
            <div className="section-heading"><div><h2>{activeView}</h2><p>{pagination?.total ?? 0} {pagination?.total === 1 ? 'task' : 'tasks'} to keep things moving</p></div><button className="filter-button" onClick={() => { setPage(1); setOrder(order === 'desc' ? 'asc' : 'desc') }} title={`Sort ${order === 'desc' ? 'ascending' : 'descending'}`} type="button">↕ <span>{getOrderLabel(sort, order)}</span></button></div>
            <div className="filter-row">
              <label><span className="sr-only">Filter by status</span><select onChange={(event) => { setPage(1); setStatusFilter(event.target.value) }} value={view === 'completed' ? 'completed' : statusFilter}><option value="">All statuses</option><option value="todo">To do</option><option value="in-progress">In progress</option><option value="completed">Completed</option></select></label>
              <label><span className="sr-only">Filter by priority</span><select onChange={(event) => { setPage(1); setPriorityFilter(event.target.value) }} value={priorityFilter}><option value="">All priorities</option><option value="high">High priority</option><option value="medium">Medium priority</option><option value="low">Low priority</option></select></label>
              <label><span className="sr-only">Filter by category</span><select onChange={(event) => { setPage(1); setCategoryView(event.target.value); setView('all') }} value={categoryView}><option value="">All categories</option><option value="uncategorized">Uncategorized</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
              <label><span className="sr-only">Sort tasks by</span><select onChange={(event) => { setPage(1); setSort(event.target.value) }} value={sort}><option value="createdAt">Date created</option><option value="dueDate">Due date</option><option value="priority">Priority</option><option value="title">Title</option><option value="updatedAt">Recently updated</option></select></label>
              <button className="clear-filters" onClick={() => setCategoryDialog({})} type="button">＋ New category</button>
              {activeCategory && <><button className="clear-filters" onClick={() => setCategoryDialog(activeCategory)} type="button">Edit category</button><button className="clear-filters" onClick={() => removeCategory(activeCategory)} type="button">Delete category</button></>}
              {(statusFilter || priorityFilter || search || categoryView) && <button className="clear-filters" onClick={() => { setPage(1); setSearch(''); setStatusFilter(''); setPriorityFilter(''); setCategoryView('') }} type="button">Clear filters</button>}
            </div>

            {tasksQuery.isLoading ? <div className="task-loading">Gathering your tasks…</div> : tasksQuery.error ? <div className="empty-state"><span>!</span><h3>Tasks couldn&apos;t load</h3><p>{requestError(tasksQuery.error)}</p><button className="secondary-button" onClick={() => tasksQuery.refetch()} type="button">Try again</button></div> : tasks.length ? <div className="task-list">{tasks.map((task) => <TaskRow key={task._id} onDelete={removeTask} onEdit={setTaskDialog} onToggle={toggleTask} task={task} />)}</div> : <div className="empty-state"><span>{debouncedSearch ? '⌕' : '✦'}</span><h3>{debouncedSearch ? 'No matching tasks' : 'A fresh page'}</h3><p>{debouncedSearch ? 'Try another search or clear your filters.' : 'Add a task when you’re ready to get started.'}</p>{!debouncedSearch && <button className="secondary-button" onClick={() => setTaskDialog({})} type="button">Create your first task</button>}</div>}

            {pagination?.pages > 1 && <div className="pagination"><span>Page {pagination.page} of {pagination.pages} · {pagination.total} tasks</span><div><button aria-label="Previous page" disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">←</button><button aria-label="Next page" disabled={page >= pagination.pages} onClick={() => setPage(page + 1)} type="button">→</button></div></div>}
          </section>
          <footer className="main-footer">Made for a little more focus, one task at a time.</footer>
        </div>
      </main>

      {taskDialog && <TaskDialog categories={categories} error={taskError} onClose={() => setTaskDialog(null)} onSave={saveTask} saving={taskSaving} task={taskDialog._id ? taskDialog : null} />}
      {categoryDialog && <CategoryDialog category={categoryDialog._id ? categoryDialog : null} error={createCategoryState.error || updateCategoryState.error} onClose={() => setCategoryDialog(null)} onSave={saveCategory} saving={createCategoryState.isLoading || updateCategoryState.isLoading} />}
    </div>
  )
}

export default App
