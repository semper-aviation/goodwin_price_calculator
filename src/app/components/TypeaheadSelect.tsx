"use client"
import { useEffect, useMemo, useRef, useState } from "react"

export type TypeaheadOption = {
  label: string
  value: string | number
}

type TypeaheadSelectProps = {
  value?: string | number
  options: TypeaheadOption[]
  placeholder?: string
  onChange: (value: string | number | undefined) => void
  inputClassName?: string
}

const DEFAULT_INPUT_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"

export default function TypeaheadSelect({
  value,
  options,
  placeholder = "Select...",
  onChange,
  inputClassName,
}: TypeaheadSelectProps) {
  const normalizedValue = value == null ? "" : String(value)
  const selectedOption = options.find(
    (option) => String(option.value) === normalizedValue
  )
  const selectedLabel = selectedOption ? selectedOption.label : normalizedValue

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [hasTyped, setHasTyped] = useState(false)

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current) return
      if (wrapperRef.current.contains(event.target as Node)) return
      setOpen(false)
      setIsEditing(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [])

  const suggestions = useMemo(() => {
    if (!hasTyped) return options.slice(0, 10)
    const term = query.trim().toLowerCase()
    if (!term) return options.slice(0, 10)
    const matches = options.filter((option) => {
      const label = option.label.toLowerCase()
      const optValue = String(option.value).toLowerCase()
      return label.includes(term) || optValue.includes(term)
    })
    return matches.slice(0, 10)
  }, [options, query, hasTyped])

  const showClear =
    (value != null && String(value) !== "") || query.trim().length > 0

  return (
    <div className="relative" ref={wrapperRef}>
      <input
        type="text"
        className={inputClassName ?? DEFAULT_INPUT_CLASSES}
        placeholder={placeholder}
        value={isEditing ? query : selectedLabel}
        onFocus={() => {
          setQuery(selectedLabel)
          setHasTyped(false)
          setIsEditing(true)
          setOpen(true)
        }}
        onChange={(e) => {
          setQuery(e.target.value)
          setHasTyped(true)
          setOpen(true)
          if (e.target.value.trim() === "") {
            onChange(undefined)
          }
        }}
        onBlur={() => {
          setTimeout(() => {
            setOpen(false)
            setIsEditing(false)
          }, 120)
        }}
      />
      {showClear && (
        <button
          type="button"
          className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setQuery("")
            setHasTyped(false)
            setIsEditing(true)
            setOpen(true)
            onChange(undefined)
          }}
          aria-label="Clear selection"
        >
          <span className="-mt-px">×</span>
        </button>
      )}
      {open && (
        <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {suggestions.length === 0 ? (
            <div className="px-3 py-2 text-sm text-slate-500">
              No matching options.
            </div>
          ) : (
            suggestions.map((option) => (
              <button
                key={`${option.value}`}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value)
                  setQuery(option.label)
                  setOpen(false)
                  setIsEditing(false)
                  setHasTyped(false)
                }}
              >
                <span className="text-slate-700">{option.label}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
