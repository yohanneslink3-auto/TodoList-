function formatDue(value) {
  if (!value) return null
  const date = new Date(value)
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(date)
}

export function TaskRow({ task, onEdit, onDelete, onToggle }) {
  return (
    <article className={`task-row ${task.status === 'completed' ? 'task-completed' : ''}`}>
      <button aria-checked={task.status === 'completed'} aria-label={`${task.status === 'completed' ? 'Reopen' : 'Complete'} ${task.title}`} className={`task-check ${task.status === 'completed' ? 'checked' : ''}`} onClick={() => onToggle(task)} role="checkbox" type="button">
        {task.status === 'completed' && '✓'}
      </button>
      <div className="task-main">
        <button className="task-title" onClick={() => onEdit(task)} type="button">{task.title}</button>
        {task.description && <p className="task-description">{task.description}</p>}
        <div className="task-meta">
          {task.category && <span className="category-chip"><span style={{ '--category-color': task.category.color }} />{task.category.name}</span>}
          {task.dueDate && <span className="task-due"><span aria-hidden="true">◷</span>{formatDue(task.dueDate)}</span>}
          {task.status === 'in-progress' && <span className="status-chip progress-chip">In progress</span>}
        </div>
      </div>
      <span className={`priority-chip priority-${task.priority}`}><span />{task.priority}</span>
      <div className="task-actions">
        <button aria-label={`Edit ${task.title}`} className="icon-button" onClick={() => onEdit(task)} type="button">✎</button>
        <button aria-label={`Delete ${task.title}`} className="icon-button delete-action" onClick={() => onDelete(task)} type="button">×</button>
      </div>
    </article>
  )
}
