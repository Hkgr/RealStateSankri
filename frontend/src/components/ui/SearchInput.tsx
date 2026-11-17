import { Search, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'

interface SearchInputProps {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  /** Wait this long after the last keystroke before reporting; use a short delay for local tables, a longer one for the server. */
  delay?: number
}

/**
 * Search box that reports after a pause in typing. It keeps its own text while the user types, so when the
 * value has to be reset from outside, give the component a new `key`.
 */
export function SearchInput({ label, placeholder, value, onChange, delay = 300 }: SearchInputProps) {
  const id = useId()
  const [text, setText] = useState(value)

  useEffect(() => {
    if (text === value) return
    const timer = setTimeout(() => onChange(text.trim()), delay)
    return () => clearTimeout(timer)
  }, [text, value, onChange, delay])

  const active = value !== '' || text !== ''
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-bold text-ink-soft">
        {label}
      </label>
      <div className={`flex h-10 items-center rounded-xl border bg-white transition-colors ${active ? 'border-brand/60 bg-brand-wash' : 'border-line-strong'}`}>
        <Search className="mx-2.5 size-4 shrink-0 text-ink-muted" aria-hidden="true" />
        <input
          id={id}
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent pe-2 text-sm font-semibold text-ink outline-none placeholder:font-normal placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
        />
        {text !== '' && (
          <button
            type="button"
            onClick={() => {
              setText('')
              onChange('')
            }}
            aria-label="مسح البحث"
            className="me-1.5 grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-muted hover:bg-paper-deep hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  )
}
