import { useEffect, useRef, useState } from 'react'

// A sideways-scrolling row that shows a soft fade on the right while there is more to scroll to,
// and brings the current tab into view. `watch` is whatever changes when the current tab changes.
export default function ScrollFade({ as: Tag = 'div', wrapperClassName = '', fadeClassName = 'from-ink-50', watch, children, ...rest }) {
  const ref = useRef(null)
  const [more, setMore] = useState(false)
  const check = () => {
    const el = ref.current
    if (el) setMore(el.scrollWidth - el.scrollLeft - el.clientWidth > 4)
  }
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const active = el.querySelector('[aria-current="page"], [aria-pressed="true"]')
    if (active && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [watch])
  return (
    <div className={`relative ${wrapperClassName}`}>
      <Tag ref={ref} onScroll={check} {...rest}>
        {children}
      </Tag>
      {more && <div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l to-transparent ${fadeClassName}`} />}
    </div>
  )
}
