function timeAgo(value) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function NotificationPopover({ data, onClose, onDismiss, onRead, onReadAll }) {
  return (
    <section aria-label="Notifications" className="notification-popover">
      <header><div><h2>Notifications</h2><p>{data?.unreadCount ? `${data.unreadCount} unread` : 'You’re all caught up'}</p></div><div className="notification-header-actions">{data?.unreadCount > 0 && <button className="text-button" onClick={onReadAll} type="button">Mark all read</button>}<button aria-label="Close notifications" className="icon-button notification-close" onClick={onClose} type="button">×</button></div></header>
      {!data?.data?.length ? <div className="notification-empty"><span>✦</span><p>No reminders yet</p><small>Task reminders will show up here.</small></div> : <ul>{data.data.map((item) => <li className={`notification-item ${item.readAt ? 'notification-read' : ''}`} key={item._id}><button className="notification-content" onClick={() => !item.readAt && onRead(item._id)} type="button"><span className={`notification-icon ${item.type}`}>{item.type === 'due' ? '!' : '◷'}</span><span className="notification-copy"><strong>{item.title}</strong><span>{item.message}</span><small>{timeAgo(item.createdAt)}</small></span>{!item.readAt && <span className="unread-dot" />}</button><button aria-label={`Dismiss ${item.title}: ${item.message}`} className="notification-dismiss" onClick={() => onDismiss(item._id)} title="Dismiss notification" type="button">×</button></li>)}</ul>}
    </section>
  )
}
