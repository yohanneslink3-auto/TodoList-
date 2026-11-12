import { useState } from 'react'

const colors = ['#818cf8', '#38bdf8', '#c084fc', '#34d399', '#fb7185', '#f59e0b']

export function CategoryDialog({ category, error, onClose, onSave, saving }) {
  const [name, setName] = useState(category?.name || '')
  const [color, setColor] = useState(category?.color || colors[0])

  function submit(event) {
    event.preventDefault()
    onSave({ name: name.trim(), color })
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section aria-labelledby="category-dialog-title" aria-modal="true" className="modal-card category-modal" role="dialog">
        <header className="modal-header"><div><p className="eyebrow">MAKE IT YOURS</p><h2 id="category-dialog-title">{category ? 'Edit category' : 'New category'}</h2></div><button aria-label="Close dialog" className="icon-button" onClick={onClose} type="button">×</button></header>
        <form className="task-form" onSubmit={submit}>
          <label>Category name<input autoFocus maxLength="32" onChange={(event) => setName(event.target.value)} placeholder="e.g. Side project" required value={name} /></label>
          <fieldset className="color-options"><legend>Choose a color</legend>{colors.map((option) => <button aria-label={`Choose ${option}`} aria-pressed={color === option} className={color === option ? 'selected' : ''} key={option} onClick={() => setColor(option)} style={{ '--swatch': option }} type="button" />)}</fieldset>
          {error && <p className="form-error" role="alert">{error.data?.error || 'Could not save category.'}</p>}
          <footer className="modal-actions"><button className="secondary-button" onClick={onClose} type="button">Cancel</button><button className="primary-button" disabled={saving || !name.trim()} type="submit">{saving ? 'Saving…' : category ? 'Save changes' : 'Create category'}</button></footer>
        </form>
      </section>
    </div>
  )
}
