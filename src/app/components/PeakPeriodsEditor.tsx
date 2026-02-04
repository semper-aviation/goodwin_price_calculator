"use client"

import React, { useState, useMemo } from "react"
import { FiInfo, FiPlus, FiTrash2, FiChevronDown, FiChevronUp, FiChevronLeft, FiChevronRight, FiCalendar } from "react-icons/fi"

type PeakPeriod = {
  id: string
  name: string
  startDate: string
  endDate: string
  zoneTimeOverrides?: Array<{
    zoneId: string
    originRepoTime: number
    destinationRepoTime: number
  }>
  repoRateMultiplier?: number
  occupiedMultiplier?: number
}

type Zone = {
  id: string
  name: string
}

const CONTROL_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
const LABEL_CLASSES = "block text-sm font-semibold text-slate-700 mb-1"

// ─────────────────────────────────────────────────────────────────────────────
// DateRangePicker - Single calendar component for selecting date ranges
// ─────────────────────────────────────────────────────────────────────────────

function DateRangePicker({
  startDate,
  endDate,
  onChange,
}: {
  startDate: string
  endDate: string
  onChange: (start: string, end: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [viewDate, setViewDate] = useState(() => {
    if (startDate) return new Date(startDate + "T00:00:00")
    return new Date()
  })
  const [selecting, setSelecting] = useState<"start" | "end" | null>(null)
  const [hoverDate, setHoverDate] = useState<string | null>(null)

  const formatDisplay = () => {
    if (!startDate && !endDate) return "Select date range"
    if (startDate && !endDate) return `${formatDateShort(startDate)} – ...`
    if (!startDate && endDate) return `... – ${formatDateShort(endDate)}`
    return `${formatDateShort(startDate)} – ${formatDateShort(endDate)}`
  }

  const formatDateShort = (dateStr: string) => {
    const d = new Date(dateStr + "T00:00:00")
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
  }

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate()
  }

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay()
  }

  const formatDateISO = (year: number, month: number, day: number) => {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  }

  const isInRange = (dateStr: string) => {
    if (!startDate || !endDate) return false
    return dateStr >= startDate && dateStr <= endDate
  }

  const isSelecting = (dateStr: string) => {
    if (!selecting || !hoverDate || !startDate) return false
    if (selecting === "end" && startDate) {
      const minD = startDate < hoverDate ? startDate : hoverDate
      const maxD = startDate > hoverDate ? startDate : hoverDate
      return dateStr >= minD && dateStr <= maxD
    }
    return false
  }

  const handleDateClick = (dateStr: string) => {
    if (!startDate || (startDate && endDate) || dateStr < startDate) {
      // Start new selection
      onChange(dateStr, "")
      setSelecting("end")
    } else {
      // Complete selection
      onChange(startDate, dateStr)
      setSelecting(null)
      setIsOpen(false)
    }
  }

  const prevMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))
  }

  const nextMonth = () => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))
  }

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const monthName = viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })

  const days: (number | null)[] = []
  for (let i = 0; i < firstDay; i++) days.push(null)
  for (let d = 1; d <= daysInMonth; d++) days.push(d)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`${CONTROL_CLASSES} flex items-center justify-between cursor-pointer`}
      >
        <span className={startDate || endDate ? "text-slate-900" : "text-slate-400"}>
          {formatDisplay()}
        </span>
        <FiCalendar className="h-4 w-4 text-slate-400" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded hover:bg-slate-100"
            >
              <FiChevronLeft className="h-5 w-5 text-slate-600" />
            </button>
            <span className="font-semibold text-slate-800">{monthName}</span>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded hover:bg-slate-100"
            >
              <FiChevronRight className="h-5 w-5 text-slate-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
              <div key={d} className="text-xs font-medium text-slate-400 text-center py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-8" />
              }
              const dateStr = formatDateISO(year, month, day)
              const isStart = dateStr === startDate
              const isEnd = dateStr === endDate
              const inRange = isInRange(dateStr)
              const isHoverRange = isSelecting(dateStr)
              const isToday = dateStr === new Date().toISOString().split("T")[0]

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDateClick(dateStr)}
                  onMouseEnter={() => setHoverDate(dateStr)}
                  onMouseLeave={() => setHoverDate(null)}
                  className={`
                    h-8 w-full rounded text-sm font-medium transition-all
                    ${isStart || isEnd ? "bg-slate-800 text-white" : ""}
                    ${inRange && !isStart && !isEnd ? "bg-slate-200 text-slate-800" : ""}
                    ${isHoverRange && !isStart ? "bg-slate-100" : ""}
                    ${!isStart && !isEnd && !inRange && !isHoverRange ? "hover:bg-slate-100 text-slate-700" : ""}
                    ${isToday && !isStart && !isEnd ? "ring-1 ring-slate-400" : ""}
                  `}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Helper text */}
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500 text-center">
            {!startDate && "Click to select start date"}
            {startDate && !endDate && "Click to select end date"}
            {startDate && endDate && (
              <button
                type="button"
                onClick={() => {
                  onChange("", "")
                  setSelecting(null)
                }}
                className="text-slate-600 hover:text-slate-800 underline"
              >
                Clear selection
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function generatePeakId(): string {
  return `peak_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function HelpIcon({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <FiInfo className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute left-7 top-1/2 z-20 w-80 -translate-y-1/2 whitespace-pre-line rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg opacity-0 transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

function PeakCard({
  peak,
  zones,
  onPeakChange,
  onDelete,
  expanded,
  onToggleExpand,
}: {
  peak: PeakPeriod
  zones: Zone[]
  onPeakChange: (peak: PeakPeriod) => void
  onDelete: () => void
  expanded: boolean
  onToggleExpand: () => void
}) {
  const updateTimeOverride = (
    zoneId: string,
    field: "originRepoTime" | "destinationRepoTime",
    value: number
  ) => {
    const existing = peak.zoneTimeOverrides?.find((m) => m.zoneId === zoneId)
    if (existing) {
      onPeakChange({
        ...peak,
        zoneTimeOverrides: peak.zoneTimeOverrides?.map((m) =>
          m.zoneId === zoneId ? { ...m, [field]: value } : m
        ),
      })
    } else {
      onPeakChange({
        ...peak,
        zoneTimeOverrides: [
          ...(peak.zoneTimeOverrides ?? []),
          {
            zoneId,
            originRepoTime: field === "originRepoTime" ? value : 0,
            destinationRepoTime: field === "destinationRepoTime" ? value : 0,
          },
        ],
      })
    }
  }

  const getTimeOverride = (
    zoneId: string,
    field: "originRepoTime" | "destinationRepoTime"
  ) => {
    return peak.zoneTimeOverrides?.find((m) => m.zoneId === zoneId)?.[field] ?? 0
  }

  const formatDateRange = () => {
    if (!peak.startDate || !peak.endDate) return "No dates set"
    return `${peak.startDate} to ${peak.endDate}`
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white mb-3">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50"
        onClick={onToggleExpand}
      >
        <div className="flex items-center gap-3">
          <span className="text-slate-400">
            {expanded ? <FiChevronUp /> : <FiChevronDown />}
          </span>
          <div>
            <div className="font-semibold text-slate-800">
              {peak.name || "Unnamed Period"}
            </div>
            <div className="text-xs text-slate-500">{formatDateRange()}</div>
          </div>
        </div>
        <button
          type="button"
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
        >
          <FiTrash2 className="h-4 w-4" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Peak name */}
          <div>
            <label className={LABEL_CLASSES}>Period Name</label>
            <input
              type="text"
              className={CONTROL_CLASSES}
              value={peak.name}
              onChange={(e) => onPeakChange({ ...peak, name: e.target.value })}
              placeholder="e.g., Holiday Peak, Summer Peak"
            />
          </div>

          {/* Date range */}
          <div>
            <label className={LABEL_CLASSES}>
              Date Range
              <HelpIcon text="Click to open the calendar and select the start date first, then the end date. The peak pricing will apply to trips within this date range." />
            </label>
            <DateRangePicker
              startDate={peak.startDate}
              endDate={peak.endDate}
              onChange={(start, end) =>
                onPeakChange({ ...peak, startDate: start, endDate: end })
              }
            />
          </div>

          {/* Rate Multipliers */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASSES}>
                Occupied Rate Multiplier
                <HelpIcon text={`Multiplier applied to the occupied (passenger) leg rate during this peak period.\n\n1.0 = no change\n1.25 = 25% increase\n0.9 = 10% discount`} />
              </label>
              <input
                type="number"
                className={CONTROL_CLASSES}
                value={peak.occupiedMultiplier ?? 1.0}
                min={0}
                step={0.05}
                onChange={(e) =>
                  onPeakChange({
                    ...peak,
                    occupiedMultiplier: parseFloat(e.target.value) || 1.0,
                  })
                }
              />
            </div>
            <div>
              <label className={LABEL_CLASSES}>
                Repo Rate Multiplier
                <HelpIcon text={`Multiplier applied to the repo rate during this peak period.\n\n1.0 = no change\n1.25 = 25% increase\n0.9 = 10% discount`} />
              </label>
              <input
                type="number"
                className={CONTROL_CLASSES}
                value={peak.repoRateMultiplier ?? 1.0}
                min={0}
                step={0.05}
                onChange={(e) =>
                  onPeakChange({
                    ...peak,
                    repoRateMultiplier: parseFloat(e.target.value) || 1.0,
                  })
                }
              />
            </div>
          </div>

          {/* Zone time overrides */}
          {zones.length > 0 && (
            <div>
              <label className={LABEL_CLASSES}>
                Zone Repo Time Overrides
                <HelpIcon text={`Override the base zone repo times during this peak period.\n\nSet to 0 to use the zone's base repo time.\nSet a value > 0 to override with a different time during peak.`} />
              </label>
              <div className="space-y-3 mt-2">
                {zones.map((zone) => (
                  <div key={zone.id} className="rounded-lg bg-slate-50 p-3">
                    <div className="text-sm font-medium text-slate-700 mb-2">
                      {zone.name}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          Origin Repo Time (hrs)
                        </label>
                        <input
                          type="number"
                          className={CONTROL_CLASSES}
                          value={getTimeOverride(zone.id, "originRepoTime")}
                          min={0}
                          step={0.1}
                          placeholder="0 = use base"
                          onChange={(e) =>
                            updateTimeOverride(
                              zone.id,
                              "originRepoTime",
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">
                          Dest Repo Time (hrs)
                        </label>
                        <input
                          type="number"
                          className={CONTROL_CLASSES}
                          value={getTimeOverride(
                            zone.id,
                            "destinationRepoTime"
                          )}
                          min={0}
                          step={0.1}
                          placeholder="0 = use base"
                          onChange={(e) =>
                            updateTimeOverride(
                              zone.id,
                              "destinationRepoTime",
                              parseFloat(e.target.value) || 0
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {zones.length === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
              Add zones first to configure zone-specific peak time overrides.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function PeakPeriodsEditor({
  label,
  help,
  value,
  zones,
  onChangeAction,
}: {
  label: string
  help?: string
  value: unknown
  zones: Zone[]
  onChangeAction: (v: unknown) => void
}) {
  const [expandedPeakId, setExpandedPeakId] = useState<string | null>(null)

  const periods: PeakPeriod[] = useMemo(() => {
    if (Array.isArray(value)) return value as PeakPeriod[]
    return []
  }, [value])

  const addPeriod = () => {
    const newId = generatePeakId()
    const newPeriod: PeakPeriod = {
      id: newId,
      name: `Peak ${periods.length + 1}`,
      startDate: "",
      endDate: "",
      occupiedMultiplier: 1.0,
      repoRateMultiplier: 1.0,
      zoneTimeOverrides: zones.map((z) => ({
        zoneId: z.id,
        originRepoTime: 0,
        destinationRepoTime: 0,
      })),
    }
    onChangeAction([...periods, newPeriod])
    setExpandedPeakId(newId)
  }

  const updatePeriod = (peakId: string, updatedPeak: PeakPeriod) => {
    onChangeAction(periods.map((p) => (p.id === peakId ? updatedPeak : p)))
  }

  const deletePeriod = (peakId: string) => {
    onChangeAction(periods.filter((p) => p.id !== peakId))
  }

  return (
    <div className="mb-4 w-full">
      <label className={`${LABEL_CLASSES} group inline-flex items-center`}>
        {label}
        {help && <HelpIcon text={help} />}
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        {periods.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            <p className="text-sm mb-4">No peak periods configured.</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              onClick={addPeriod}
            >
              <FiPlus /> Add Peak Period
            </button>
          </div>
        ) : (
          <>
            {periods.map((peak) => (
              <PeakCard
                key={peak.id}
                peak={peak}
                zones={zones}
                onPeakChange={(p) => updatePeriod(peak.id, p)}
                onDelete={() => deletePeriod(peak.id)}
                expanded={expandedPeakId === peak.id}
                onToggleExpand={() =>
                  setExpandedPeakId(expandedPeakId === peak.id ? null : peak.id)
                }
              />
            ))}
            <button
              type="button"
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              onClick={addPeriod}
            >
              <FiPlus /> Add Peak Period
            </button>
          </>
        )}
      </div>
    </div>
  )
}
