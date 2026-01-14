"use client"
import { useEffect, useRef, useState } from "react"
import { FiInfo } from "react-icons/fi"
import { KNOB_UI_TABS, KnobUiField } from "./knobsSchema"
import TypeaheadSelect from "./TypeaheadSelect"
import airportsData, { type Airport } from "../data/airports"
import { GeoRulesEditor } from "./GeoRulesEditor"

const CONTROL_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
const LABEL_CLASSES = "block text-sm font-semibold text-slate-700 mb-1"

function HelpIcon({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center">
      <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <FiInfo className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute left-7 top-1/2 z-20 w-64 -translate-y-1/2 whitespace-pre-line rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg opacity-0 transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

const AIRPORT_OPTIONS = airportsData
  .map((airport) => ({
    label: airport.icao,
    value: airport,
  }))
  .sort((a, b) => a.label.localeCompare(b.label))

function parseAirportCodes(value: string | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((code) => code.trim())
    .filter(Boolean)
}

function formatAirportCodes(codes: string[]) {
  return codes.length ? codes.join(", ") : undefined
}

function SingleAirportSelect({
  label,
  value,
  help,
  placeholder,
  required,
  onChange,
}: {
  label: string
  value: string | undefined
  help?: string
  placeholder?: string
  required?: boolean
  onChange: (value: string | undefined) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [hasTyped, setHasTyped] = useState(false)

  const suggestions = AIRPORT_OPTIONS.filter((opt) => {
    if (!hasTyped) return true
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return true
    const icao = opt.label.toLowerCase()
    const name = (opt.value.name ?? "").toLowerCase()
    const city = (opt.value.city ?? "").toLowerCase()
    const state = opt.value.state.toLowerCase()
    return (
      icao.includes(trimmed) ||
      name.includes(trimmed) ||
      city.includes(trimmed) ||
      state.includes(trimmed)
    )
  }).slice(0, 10)

  return (
    <div className="mb-4">
      <label className={`${LABEL_CLASSES} group inline-flex items-center`}>
        {label}
        {required ? <span className="ml-1 text-amber-600">*</span> : null}
        {help ? <HelpIcon text={help} /> : null}
      </label>
      <div className="relative">
        <input
          type="text"
          className={`${CONTROL_CLASSES} pr-10`}
          placeholder={placeholder ?? "Search airport..."}
          value={query || value || ""}
          onChange={(e) => {
            setQuery(e.target.value)
            setHasTyped(true)
            setOpen(true)
            if (e.target.value.trim() === "") {
              onChange(undefined)
            }
          }}
          onFocus={() => {
            setQuery("")
            setHasTyped(false)
            setOpen(true)
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 120)
          }}
        />
        {(value || query.trim()) && (
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("")
              setHasTyped(false)
              setOpen(true)
              onChange(undefined)
            }}
            aria-label="Clear selection"
          >
            ×
          </button>
        )}
        {open && (
          <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                No matching airports.
              </div>
            ) : (
              suggestions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    onChange(opt.label)
                    setQuery("")
                    setHasTyped(false)
                    setOpen(false)
                  }}
                >
                  <span className="min-w-[3.5rem] font-semibold text-slate-700">
                    {opt.label}
                  </span>
                  <span className="text-slate-600">
                    {opt.value.name ?? opt.value.icao}
                    {opt.value.city
                      ? ` (${opt.value.city}, ${opt.value.state})`
                      : ` (${opt.value.state})`}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MultiAirportSelect({
  label,
  value,
  help,
  required,
  onChange,
}: {
  label: string
  value: string | undefined
  help?: string
  required?: boolean
  onChange: (value: string | undefined) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [hasTyped, setHasTyped] = useState(false)
  const selected = parseAirportCodes(value)

  const suggestions = AIRPORT_OPTIONS.filter((opt) => {
    if (!hasTyped) return true
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return true
    const icao = opt.label.toLowerCase()
    const name = (opt.value.name ?? "").toLowerCase()
    const city = (opt.value.city ?? "").toLowerCase()
    const state = opt.value.state.toLowerCase()
    return (
      icao.includes(trimmed) ||
      name.includes(trimmed) ||
      city.includes(trimmed) ||
      state.includes(trimmed)
    )
  })
    .filter((opt) => !selected.includes(opt.label))
    .slice(0, 10)

  const removeCode = (code: string) => {
    const next = selected.filter((item) => item !== code)
    onChange(formatAirportCodes(next))
  }

  const addCode = (airport: Airport) => {
    const next = [...selected, airport.icao]
    onChange(formatAirportCodes(next))
    setQuery("")
    setHasTyped(false)
    setOpen(false)
    requestAnimationFrame(() => inputRef.current?.blur())
  }

  return (
    <div className="mb-4">
      <label className={`${LABEL_CLASSES} group inline-flex items-center`}>
        {label}
        {required ? <span className="ml-1 text-amber-600">*</span> : null}
        {help ? <HelpIcon text={help} /> : null}
      </label>
      <div className="relative">
        <input
          type="text"
          className={`${CONTROL_CLASSES} pr-10`}
          placeholder="Type ICAO, airport name, or city..."
          value={query}
          ref={inputRef}
          onChange={(e) => {
            setQuery(e.target.value)
            setHasTyped(true)
            setOpen(true)
          }}
          onFocus={() => {
            setQuery("")
            setHasTyped(false)
            setOpen(true)
          }}
          onBlur={() => {
            setTimeout(() => setOpen(false), 120)
          }}
        />
        {query.trim() && (
          <button
            type="button"
            className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setQuery("")
              setHasTyped(false)
              setOpen(true)
            }}
            aria-label="Clear search"
          >
            ×
          </button>
        )}
        {open && (
          <div className="absolute z-10 mt-2 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg">
            {suggestions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500">
                No matching airports.
              </div>
            ) : (
              suggestions.map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 focus:bg-slate-50"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addCode(opt.value)}
                >
                  <span className="min-w-[3.5rem] font-semibold text-slate-700">
                    {opt.label}
                  </span>
                  <span className="text-slate-600">
                    {opt.value.name ?? opt.value.icao}
                    {opt.value.city
                      ? ` (${opt.value.city}, ${opt.value.state})`
                      : ` (${opt.value.state})`}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selected.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700"
            >
              {code}
              <button
                type="button"
                className="text-slate-400 transition hover:text-slate-600"
                onClick={() => removeCode(code)}
                aria-label={`Remove ${code}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export type KnobValue = string | number | boolean | undefined | unknown

// --- Field Renderers ---
function Field({
  field,
  value,
  onChange,
  required,
}: {
  field: KnobUiField
  value: KnobValue
  onChange: (v: KnobValue) => void
  required?: boolean
}) {
  switch (field.type) {
    case "select": {
      const selectValue =
        typeof value === "string" || typeof value === "number" ? value : ""
      return (
        <div className="mb-4">
          <label className={`${LABEL_CLASSES} group inline-flex items-center`}>
            {field.label}
            {required ? <span className="ml-1 text-amber-600">*</span> : null}
            {field.help ? <HelpIcon text={field.help} /> : null}
          </label>
          <TypeaheadSelect
            value={selectValue}
            options={field.options}
            onChange={(v) =>
              onChange(typeof v === "string" ? v : v ?? undefined)
            }
            inputClassName={`${CONTROL_CLASSES} pr-10`}
          />
        </div>
      )
    }
    case "number": {
      const numberValue =
        typeof value === "number" || typeof value === "string" ? value : ""
      return (
        <div className="mb-4">
          <label className={`${LABEL_CLASSES} group inline-flex items-center`}>
            {field.label}
            {required ? <span className="ml-1 text-amber-600">*</span> : null}
            {field.help ? <HelpIcon text={field.help} /> : null}
          </label>
          <input
            type="number"
            className={CONTROL_CLASSES}
            value={numberValue}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(e) =>
              onChange(
                e.target.value === "" ? undefined : Number(e.target.value)
              )
            }
          />
        </div>
      )
    }
    case "toggle":
      return (
        <div className="mb-4">
          <div className="flex items-center gap-3">
            <label
              className={`${LABEL_CLASSES} group inline-flex items-center`}
            >
              {field.label}
              {required ? <span className="ml-1 text-amber-600">*</span> : null}
              {field.help ? <HelpIcon text={field.help} /> : null}
            </label>
            <span className="ml-auto">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={!!value}
                  onChange={(e) => onChange(e.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-slate-700" />
                <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
              </label>
            </span>
          </div>
        </div>
      )
    case "airportMulti": {
      const airportValue = typeof value === "string" ? value : undefined
      return (
        <MultiAirportSelect
          label={field.label}
          value={airportValue}
          help={field.help}
          required={required}
          onChange={(v) => onChange(v)}
        />
      )
    }
    case "airportSingle": {
      const airportValue = typeof value === "string" ? value : undefined
      return (
        <SingleAirportSelect
          label={field.label}
          value={airportValue}
          help={field.help}
          placeholder={field.placeholder}
          required={required}
          onChange={(v) => onChange(v)}
        />
      )
    }
    case "geoRulesEditor":
      return (
        <GeoRulesEditor
          label={field.label}
          help={field.help}
          value={value}
          onChangeAction={onChange}
        />
      )
    case "icalLink": {
      const textValue = typeof value === "string" ? value : ""
      const trimmedValue = textValue.trim()
      const buttonLabel = field.buttonLabel ?? "Open"
      const fallbackValue = field.defaultValue
      return (
        <div className="mb-4">
          <label className={`${LABEL_CLASSES} group inline-flex items-center`}>
            {field.label}
            {required ? <span className="ml-1 text-amber-600">*</span> : null}
            {field.help ? <HelpIcon text={field.help} /> : null}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <input
                type="url"
                className={`${CONTROL_CLASSES} pr-10`}
                placeholder={field.placeholder}
                value={textValue}
                onChange={(e) =>
                  onChange(
                    e.target.value === ""
                      ? fallbackValue ?? undefined
                      : e.target.value
                  )
                }
              />
              {trimmedValue && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-xs font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  onClick={() => onChange(fallbackValue ?? undefined)}
                  aria-label="Clear iCal link"
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!trimmedValue}
              onClick={() => {
                if (!trimmedValue) return
                const url = `/ical?ical=${encodeURIComponent(trimmedValue)}`
                window.open(url, "_blank", "noopener,noreferrer")
              }}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      )
    }

    default:
      return null
  }
}

function isFieldValueSet(field: KnobUiField, value: unknown) {
  if (value == null) return false
  if (field.type === "toggle") return value === true
  if (field.type === "number") return value !== ""
  if (field.type === "airportMulti")
    return typeof value === "string" && value.trim().length > 0
  return typeof value === "string" && value.trim().length > 0
}

// --- Main KnobPanel ---
export default function KnobPanel({
  tripComplete,
  onKnobsChangeAction,
  defaultValues,
}: {
  tripComplete: boolean
  onKnobsChangeAction?: (values: Record<string, KnobValue>) => void
  defaultValues?: Record<string, KnobValue>
}) {
  const [tabIdx, setTabIdx] = useState<number>(0)
  const [values, setValues] = useState<Record<string, KnobValue>>(
    defaultValues ?? {}
  )

  useEffect(() => {
    if (onKnobsChangeAction) onKnobsChangeAction(values)
  }, [onKnobsChangeAction, values])

  if (!tripComplete) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
        <div className="text-base font-semibold text-slate-800 mb-4">
          Pricing Knobs
        </div>
        <div className="text-sm text-slate-500">
          <span role="img" aria-label="locked" className="mr-2">
            🔒
          </span>
          Complete trip details to unlock pricing knobs.
        </div>
      </div>
    )
  }

  const tabOrder = ["basics", "fees", "discounts", "time", "eligibility"]
  const tabs = KNOB_UI_TABS.filter((tab) => tabOrder.includes(tab.id)).sort(
    (a, b) => tabOrder.indexOf(a.id) - tabOrder.indexOf(b.id)
  )
  const currentTab = tabs[tabIdx]

  function getFieldValue(path: string) {
    if (values[path] != null) return values[path]
    return defaultValues ? defaultValues[path] : undefined
  }

  const repoMode = String(getFieldValue("repo.mode") ?? "")

  function evaluateCondition(condition: string) {
    if (condition === "tripComplete") return tripComplete
    const equalsMatch = condition.match(/^(.+?)\s*===\s*'(.+)'$/)
    if (equalsMatch) {
      const [, path, expected] = equalsMatch
      return String(getFieldValue(path.trim())) === expected
    }
    const notEqualsMatch = condition.match(/^(.+?)\s*!==\s*'(.+)'$/)
    if (notEqualsMatch) {
      const [, path, expected] = notEqualsMatch
      return String(getFieldValue(path.trim())) !== expected
    }
    const compareMatch = condition.match(/^(.+?)\s*(>=|<=|>|<)\s*([\d.]+)$/)
    if (compareMatch) {
      const [, path, operator, raw] = compareMatch
      const leftValue = getFieldValue(path.trim())
      const leftNumber =
        typeof leftValue === "number" ? leftValue : Number(leftValue ?? NaN)
      const rightNumber = Number(raw)
      if (Number.isNaN(leftNumber) || Number.isNaN(rightNumber)) return false
      switch (operator) {
        case ">":
          return leftNumber > rightNumber
        case ">=":
          return leftNumber >= rightNumber
        case "<":
          return leftNumber < rightNumber
        case "<=":
          return leftNumber <= rightNumber
        default:
          return false
      }
    }
    const value = getFieldValue(condition)
    return Boolean(value)
  }

  function isEnabled(field: KnobUiField) {
    if (!field.enabledWhen) return true
    if (field.path === "pricing.hourlyRate") {
      return (
        tripComplete &&
        String(getFieldValue("pricing.rateModel")) === "single_hourly"
      )
    }
    if (
      field.path === "pricing.repoRate" ||
      field.path === "pricing.occupiedRate"
    ) {
      return (
        tripComplete &&
        String(getFieldValue("pricing.rateModel")) === "dual_rate_repo_occupied"
      )
    }
    if (field.path === "repo.fixedBaseIcao") {
      return tripComplete && repoMode === "fixed_base"
    }
    if (
      field.path === "repo.vhbSelection" ||
      field.path.startsWith("repo.vhbSets")
    ) {
      return tripComplete && repoMode === "vhb_network"
    }
    const conditions = field.enabledWhen.split("&&").map((part) => part.trim())
    return conditions.every((condition) => evaluateCondition(condition))
  }

  function isRequired(field: KnobUiField) {
    if (field.path === "repo.fixedBaseIcao") {
      return repoMode === "fixed_base"
    }
    if (field.path === "repo.vhbSets.default") {
      return repoMode === "vhb_network"
    }
    const rateModel = String(getFieldValue("pricing.rateModel") ?? "")
    if (field.path === "pricing.hourlyRate") {
      return rateModel === "single_hourly"
    }
    if (
      field.path === "pricing.repoRate" ||
      field.path === "pricing.occupiedRate"
    ) {
      return rateModel === "dual_rate_repo_occupied"
    }
    return false
  }

  function handleFieldChange(path: string, value: KnobValue) {
    setValues((v) => {
      const next = { ...v, [path]: value }
      if (path === "pricing.rateModel") {
        if (value === "single_hourly") {
          delete next["pricing.repoRate"]
          delete next["pricing.occupiedRate"]
        }
        if (value === "dual_rate_repo_occupied") {
          delete next["pricing.hourlyRate"]
        }
      }
      if (path === "repo.mode") {
        if (value === "fixed_base") {
          delete next["repo.vhbSets.default"]
          delete next["repo.vhbSelection"]
        }
        if (value === "vhb_network") {
          delete next["repo.fixedBaseIcao"]
          next["repo.vhbSelection"] = "closest_by_distance"
        }
      }
      return next
    })
  }

  const tabHasChanges = tabs.map((tab) =>
    tab.sections.some((section) =>
      section.fields.some((field) => isFieldValueSet(field, values[field.path]))
    )
  )

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm backdrop-blur">
      <div className="text-base font-semibold text-slate-800 mb-4">
        Pricing Knobs
      </div>
      <div className="mb-4 border-b border-slate-200 flex rounded-t-lg bg-white/80">
        {tabs.map((tab, i) => (
          <button
            key={tab.id}
            className={`px-4 py-2 -mb-px border-b-2 whitespace-nowrap text-sm transition-colors ${
              i === tabIdx
                ? "border-slate-800 font-semibold text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            onClick={() => setTabIdx(i)}
          >
            <span className="relative inline-flex items-center gap-2">
              {tab.title}
              {tabHasChanges[i] && (
                <span className="h-2 w-2 rounded-full bg-amber-400" />
              )}
            </span>
          </button>
        ))}
      </div>
      <div>
        {currentTab.sections.map((section) => {
          const enabledFields = section.fields.filter(isEnabled)
          if (enabledFields.length === 0) return null
          return (
            <div key={section.title} className="mb-6">
              <div className="pb-4">
                <div className="text-base font-semibold text-slate-700 mb-1">
                  {section.title}
                </div>
                {section.description && (
                  <div className="text-sm text-slate-500">
                    {section.description}
                  </div>
                )}
              </div>
            <div
              className={`grid grid-cols-1 gap-4 ${
                section.title === "Geographic Rules" ? "" : "md:grid-cols-2"
              }`}
            >
              {enabledFields.map((field) => (
                <div key={field.path}>
                  <Field
                    field={field}
                    value={values[field.path]}
                    onChange={(v) => handleFieldChange(field.path, v)}
                    required={isRequired(field)}
                  />
                </div>
              ))}
            </div>
          </div>
          )
        })}
      </div>
    </div>
  )
}
