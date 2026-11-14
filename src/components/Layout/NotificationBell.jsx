import { useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../ui/Icon'
import { useNotifications } from '../../context/NotificationsContext'
import NotificationsPanel from './NotificationsPanel'

// The bell with an unread count. Hidden until migration 29 has been run.
export default function NotificationBell({ onOpenProject, className = '', label = false }) {
  const { ready, unread } = useNotifications()
  const [open, setOpen] = useState(false)
  if (!ready) return null
  return (
    <>
      <button onClick={() => setOpen(true)} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className={`relative ${className}`}>
        <Icon name="bell" size={label ? 16 : 20} />
        {label && 'Notifications'}
        {unread > 0 && (
          <span className={`absolute flex h-4 min-w-[16px] items-center justify-center rounded-full bg-signal-500 px-1 text-[10px] font-bold text-ink-950 ${label ? 'right-2 top-2' : 'right-0.5 top-0.5'}`}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && createPortal(<NotificationsPanel onClose={() => setOpen(false)} onOpen={onOpenProject} />, document.body)}
    </>
  )
}
