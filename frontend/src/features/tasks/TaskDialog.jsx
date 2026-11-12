import { useState } from 'react'

function dateTimeValue(value) {
  if (!value) return ''
  const date = new Date(value)
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
  return date.toISOString().slice(0, 16)
}

function apiDate(value) {
  return value ? new Date(value).toISOString() : null
}

function getError(error) {
  return error?.data?.error || 'Could not save this task. Please try again.'
}

export function TaskDialog({ task, categories, error, onClose, onSave, saving }) {
  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [status, setStatus] = useState(task?.status || 'todo')
  const [priority, setPriority] = useState(task?.priority || 'medium')
  const [category, setCategory] = useState(task?.category?._id || task?.category || '')
  const [dueDate, setDueDate] = useState(dateTimeValue(task?.dueDate))
  const [reminderAt, setReminderAt] = useState(dateTimeValue(task?.reminderAt))

  function submit(event) {
    event.preventDefault()
    onSave({
      title: title.trim(),
      description: description.trim(),
      status,
      priority,
      category: category || null,
      dueDate: apiDate(dueDate),
      reminderAt: apiDate(reminderAt),
    })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="task-dialog-title" aria-modal="true" className="modal-card" role="dialog">
        <header className="modal-header">
          <div><p className="eyebrow">{task ? 'KEEP IT MOVING' : 'MAKE A LITTLE PROGRESS'}</p><h2 id="task-dialog-title">{task ? 'Edit task' : 'Create a task'}</h2></div>
          <button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button">×</button>
        </header>
        <form className="task-form" onSubmit={submit}>
          <label className="field-full">Task title<input autoFocus maxLength="160" onChange={(event) => setTitle(event.target.value)} placeholder="What would you like to get done?" required value={title} /></label>
          <label className="field-full">Notes<textarea maxLength="2000" onChange={(event) => setDescription(event.target.value)} placeholder="Add a few details (optional)" rows="3" value={description} /></label>
          <div className="form-grid">
            <label>Status<select onChange={(event) => setStatus(event.target.value)} value={status}><option value="todo">To do</option><option value="in-progress">In progress</option><option value="completed">Completed</option></select></label>
            <label>Priority<select onChange={(event) => setPriority(event.target.value)} value={priority}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
            <label>Category<select onChange={(event) => setCategory(event.target.value)} value={category}><option value="">Uncategorized</option>{categories.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select></label>
            <label>Due date<input onChange={(event) => setDueDate(event.target.value)} type="datetime-local" value={dueDate} /></label>
            <label className="field-full">Remind me at<input disabled={!dueDate} max={dueDate || undefined} onChange={(event) => setReminderAt(event.target.value)} type="datetime-local" value={reminderAt} /><small>In-app reminder. Add a due date first.</small></label>
          </div>
          {error && <p className="form-error" role="alert">{getError(error)}</p>}
          <footer className="modal-actions"><button className="secondary-button" onClick={onClose} type="button">Cancel</button><button className="primary-button" disabled={saving || !title.trim()} type="submit">{saving ? 'Saving…' : task ? 'Save changes' : 'Create task'}</button></footer>
        </form>
      </section>
    </div>
  )
}
