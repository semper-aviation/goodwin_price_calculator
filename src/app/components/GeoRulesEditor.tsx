"use client"

import React, { useMemo } from "react"
import { FiInfo } from "react-icons/fi"

const CONTROL_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
const LABEL_CLASSES = "block text-sm font-semibold text-slate-700 mb-1"

function HelpIcon({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <FiInfo className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute left-7 top-1/2 z-20 w-72 -translate-y-1/2 whitespace-pre-line rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg opacity-0 transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

export type MississippiRule = {
  type: "mississippi_rule"
  oneWayRequires: "both_east" | "both_west"
  roundTripUpToNightsRequiresOrigin: number
  roundTripUpToNightsSide: "east" | "west"
  roundTripBeyondNightsRequires: "both_east" | "both_west"
}

export type GeoRule = MississippiRule

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isMississippiRule(value: unknown): value is MississippiRule {
  if (!isRecord(value)) return false

  // type
  if (value["type"] !== "mississippi_rule") return false

  // oneWayRequires
  const oneWay = value["oneWayRequires"]
  if (oneWay !== "both_east" && oneWay !== "both_west") return false

  // roundTripUpToNightsRequiresOrigin
  const upTo = value["roundTripUpToNightsRequiresOrigin"]
  if (typeof upTo !== "number" || Number.isNaN(upTo)) return false

  // roundTripUpToNightsSide
  const side = value["roundTripUpToNightsSide"]
  if (side !== "east" && side !== "west") return false

  // roundTripBeyondNightsRequires
  const beyond = value["roundTripBeyondNightsRequires"]
  if (beyond !== "both_east" && beyond !== "both_west") return false

  return true
}

function isGeoRuleArray(value: unknown): value is GeoRule[] {
  return Array.isArray(value) && value.every((r) => isMississippiRule(r))
}

function getMississippi(rules: GeoRule[]): MississippiRule | null {
  const found = rules.find((x) => x.type === "mississippi_rule")
  return found ?? null
}

const BOTH_SIDE_OPTIONS: Array<{
  label: string
  value: MississippiRule["oneWayRequires"]
}> = [
  { label: "Both East", value: "both_east" },
  { label: "Both West", value: "both_west" },
]

const SIDE_OPTIONS: Array<{
  label: string
  value: MississippiRule["roundTripUpToNightsSide"]
}> = [
  { label: "East", value: "east" },
  { label: "West", value: "west" },
]

const BEYOND_OPTIONS: Array<{
  label: string
  value: MississippiRule["roundTripBeyondNightsRequires"]
}> = [
  { label: "Both East", value: "both_east" },
  { label: "Both West", value: "both_west" },
]

export function GeoRulesEditor({
  label,
  help,
  value,
  onChangeAction,
}: {
  label: string
  help?: string
  value: unknown
  onChangeAction: (v: unknown) => void
}) {
  const rules: GeoRule[] = useMemo(() => {
    if (!value) return []
    if (isGeoRuleArray(value)) return value
    return []
  }, [value])

  const mississippi = getMississippi(rules)

  const setRule = (next: MississippiRule | null) => {
    if (!next) onChangeAction([])
    else onChangeAction([next])
  }

  const setEnabled = (enabled: boolean) => {
    if (!enabled) {
      setRule(null)
      return
    }
    const defaults: MississippiRule = {
      type: "mississippi_rule",
      oneWayRequires: "both_east",
      roundTripUpToNightsRequiresOrigin: 2,
      roundTripUpToNightsSide: "east",
      roundTripBeyondNightsRequires: "both_east",
    }
    setRule(mississippi ?? defaults)
  }

  return (
    <div className="mb-4">
      <label className={`${LABEL_CLASSES} group inline-flex items-center`}>
        {label}
        {help ? <HelpIcon text={help} /> : null}
      </label>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="rounded-xl bg-slate-50 p-3">
          <div className="flex items-start gap-3">
            <div>
              <div className="text-sm font-semibold text-slate-800">
                Mississippi rule
              </div>
              <div className="mt-0.5 text-xs text-slate-500">
                Enforce east/west constraints based on trip type and number of
                nights.
              </div>
            </div>

            <div className="ml-auto pt-0.5">
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={!!mississippi}
                  onChange={(e) => setEnabled(e.target.checked)}
                />
                <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-slate-700" />
                <span className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
              </label>
            </div>
          </div>

          {mississippi && (
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600">
                  One-way requires
                </div>
                <select
                  className={CONTROL_CLASSES}
                  value={mississippi.oneWayRequires}
                  onChange={(e) =>
                    setRule({
                      ...mississippi,
                      oneWayRequires: e.target
                        .value as MississippiRule["oneWayRequires"],
                    })
                  }
                >
                  {BOTH_SIDE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600">
                  RT: up to N nights requires origin
                </div>
                <input
                  type="number"
                  className={CONTROL_CLASSES}
                  min={0}
                  step={1}
                  value={mississippi.roundTripUpToNightsRequiresOrigin}
                  onChange={(e) => {
                    const n =
                      e.target.value === ""
                        ? 0
                        : Math.max(0, Number(e.target.value))
                    setRule({
                      ...mississippi,
                      roundTripUpToNightsRequiresOrigin: n,
                    })
                  }}
                />
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600">
                  RT: up to N nights side
                </div>
                <select
                  className={CONTROL_CLASSES}
                  value={mississippi.roundTripUpToNightsSide}
                  onChange={(e) =>
                    setRule({
                      ...mississippi,
                      roundTripUpToNightsSide: e.target
                        .value as MississippiRule["roundTripUpToNightsSide"],
                    })
                  }
                >
                  {SIDE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1 text-xs font-semibold text-slate-600">
                  RT: beyond N nights requires
                </div>
                <select
                  className={CONTROL_CLASSES}
                  value={mississippi.roundTripBeyondNightsRequires}
                  onChange={(e) =>
                    setRule({
                      ...mississippi,
                      roundTripBeyondNightsRequires: e.target
                        .value as MississippiRule["roundTripBeyondNightsRequires"],
                    })
                  }
                >
                  {BEYOND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="mt-3 text-xs text-slate-500">
          Stored as an array at{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 font-mono">
            eligibility.geoRules
          </code>
        </div>
      </div>
    </div>
  )
}
