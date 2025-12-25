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
      <span className="pointer-events-none absolute left-7 top-1/2 z-20 w-80 -translate-y-1/2 whitespace-pre-line rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg opacity-0 transition group-hover:opacity-100">
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
  if (value["type"] !== "mississippi_rule") return false

  const oneWay = value["oneWayRequires"]
  if (oneWay !== "both_east" && oneWay !== "both_west") return false

  const upTo = value["roundTripUpToNightsRequiresOrigin"]
  if (typeof upTo !== "number" || Number.isNaN(upTo)) return false

  const side = value["roundTripUpToNightsSide"]
  if (side !== "east" && side !== "west") return false

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
  { label: "Both airports must be EAST", value: "both_east" },
  { label: "Both airports must be WEST", value: "both_west" },
]

const SIDE_OPTIONS: Array<{
  label: string
  value: MississippiRule["roundTripUpToNightsSide"]
}> = [
  { label: "Origin must be EAST", value: "east" },
  { label: "Origin must be WEST", value: "west" },
]

const BEYOND_OPTIONS: Array<{
  label: string
  value: MississippiRule["roundTripBeyondNightsRequires"]
}> = [
  { label: "Both airports must be EAST", value: "both_east" },
  { label: "Both airports must be WEST", value: "both_west" },
]

function prettyBoth(v: "both_east" | "both_west") {
  return v === "both_east" ? "EAST" : "WEST"
}

function prettySide(v: "east" | "west") {
  return v === "east" ? "EAST" : "WEST"
}

function clampInt(n: number) {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.floor(n))
}

function buildSummary(r: MississippiRule) {
  const n = clampInt(r.roundTripUpToNightsRequiresOrigin)
  return [
    `ONE-WAY: origin + destination must both be ${prettyBoth(
      r.oneWayRequires
    )}.`,
    `ROUND-TRIP (≤ ${n} night${
      n === 1 ? "" : "s"
    }): origin must be ${prettySide(
      r.roundTripUpToNightsSide
    )} (destination may cross).`,
    `ROUND-TRIP (> ${n} night${
      n === 1 ? "" : "s"
    }): origin + destination must both be ${prettyBoth(
      r.roundTripBeyondNightsRequires
    )}.`,
  ].join("\n")
}

function TinyBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
      {children}
    </span>
  )
}

function Card({
  title,
  subtitle,
  children,
  badge,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className=" p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-slate-800">{title}</div>
          {subtitle ? (
            <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div>
          ) : null}
        </div>
        {badge ? <div className="pt-0.5">{badge}</div> : null}
      </div>
      <div className="mt-3">{children}</div>
    </div>
  )
}

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

  const summary = mississippi ? buildSummary(mississippi) : ""

  return (
    <div className="mb-4 w-full">
      <label className={`${LABEL_CLASSES} group inline-flex items-center`}>
        {label}
        {help ? <HelpIcon text={help} /> : null}
      </label>

      <div className="w-full rounded-xl border border-slate-200 bg-white p-6">
        {/* Header / toggle */}
        <div className="flex items-start gap-3">
          <div className="min-w-0 w-full">
            <div className="text-sm font-semibold text-slate-800">
              Mississippi geographic rule
            </div>
            <div className="mt-0.5 text-xs text-slate-500">
              Restricts which side of the Mississippi River a trip is allowed to
              operate on. Short round-trips can be more flexible than long
              stays.
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

        {!mississippi ? (
          <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            <div className="font-semibold text-slate-700">Disabled</div>
            <div className="mt-0.5 text-xs text-slate-500">
              Turn this on to enforce east/west eligibility logic.
            </div>
          </div>
        ) : (
          <div className="mt-4 w-full space-y-3">
            {/* Rule preview */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
              <div className="flex items-center gap-2">
                <div className="text-xs font-semibold text-slate-700">
                  Rule preview
                </div>
                <TinyBadge>Live</TinyBadge>
              </div>
              <pre className="mt-2 whitespace-pre-wrap text-xs leading-5 text-slate-700">
                {summary}
              </pre>
            </div>

            {/* 3 clear buckets */}
            <div className="grid  grid-cols-1 gap-3 md:grid-cols-3">
              {/* One-way */}
              <Card
                title="One-way trips"
                subtitle="Applies when tripType = ONE_WAY"
                // badge={<TinyBadge>ONE_WAY</TinyBadge>}
              >
                <div className="mb-1 text-xs font-semibold text-slate-600">
                  Requirement
                  <HelpIcon
                    text={
                      "If a one-way crosses the river, reject.\n\nExample:\n- ATL → BOS (east→east): allowed\n- ATL → DAL (east→west): rejected"
                    }
                  />
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

                <div className="mt-2 text-xs text-slate-500">
                  Meaning: both origin and destination must be on the same side.
                </div>
              </Card>

              {/* Round-trip short */}
              <Card
                title="Round-trip (short stay)"
                subtitle="When nights away ≤ N"
                //  badge={<TinyBadge>ROUND_TRIP</TinyBadge>}
              >
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-600">
                      N = max nights for “short stay”
                      <HelpIcon
                        text={
                          "Nights are counted as midnights between departLocalISO and returnLocalISO.\n\nIf overnights ≤ N → use the origin-side rule.\nIf overnights > N → use the long-stay rule."
                        }
                      />
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
                            : clampInt(Number(e.target.value))
                        setRule({
                          ...mississippi,
                          roundTripUpToNightsRequiresOrigin: n,
                        })
                      }}
                    />
                  </div>

                  <div>
                    <div className="mb-1 text-xs font-semibold text-slate-600">
                      Origin must be on this side
                      <HelpIcon
                        text={
                          "For short stays, only the ORIGIN side is enforced.\nDestination may be across the river.\n\nExample (origin=EAST):\n- ATL ↔ DAL, 1 night: allowed\n- DAL ↔ ATL, 1 night: rejected"
                        }
                      />
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
                </div>
              </Card>

              {/* Round-trip long */}
              <Card
                title="Round-trip (long stay)"
                subtitle="When nights away > N"
                // badge={<TinyBadge>ROUND_TRIP</TinyBadge>}
              >
                <div className="mb-1 text-xs font-semibold text-slate-600">
                  Requirement for long stays
                  <HelpIcon
                    text={
                      "Long stays are stricter: BOTH origin and destination must be on the required side.\n\nExample (both EAST):\n- ATL ↔ BOS, 4 nights: allowed\n- ATL ↔ DAL, 4 nights: rejected"
                    }
                  />
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

                <div className="mt-2 text-xs text-slate-500">
                  Meaning: long trips must stay entirely on one side.
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
