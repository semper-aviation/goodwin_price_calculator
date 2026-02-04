"use client"

import React, { useState, useMemo } from "react"
import { FiInfo, FiPlus, FiTrash2 } from "react-icons/fi"

// US States list
const US_STATES = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
  { code: "DC", name: "District of Columbia" },
]

// Types matching the engine types
type Zone = {
  id: string
  name: string
  states: string[]
}

type ZoneRepoTimes = {
  zoneId: string
  originRepoTime: number
  destinationRepoTime: number
}

type ZoneNetworkConfig = {
  zones: Zone[]
  zoneRepoTimes: ZoneRepoTimes[]
  peakPeriods?: unknown[]
  selectionMethod: "closest_in_zone" | "state_based"
}

const CONTROL_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
const LABEL_CLASSES = "block text-xs font-semibold text-slate-600 mb-1"

function generateZoneId(): string {
  return `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function HelpIcon({ text }: { text: string }) {
  return (
    <span className="relative inline-flex items-center group">
      <span className="ml-1 inline-flex h-4 w-4 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <FiInfo className="h-3 w-3" aria-hidden="true" />
      </span>
      <span className="pointer-events-none absolute left-5 top-1/2 z-20 w-64 -translate-y-1/2 whitespace-pre-line rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-lg opacity-0 transition group-hover:opacity-100">
        {text}
      </span>
    </span>
  )
}

function ZoneRow({
  zone,
  times,
  onZoneChange,
  onTimesChange,
  onDelete,
  usedStates,
}: {
  zone: Zone
  times: ZoneRepoTimes
  onZoneChange: (zone: Zone) => void
  onTimesChange: (times: ZoneRepoTimes) => void
  onDelete: () => void
  usedStates: Set<string>
}) {
  const [stateQuery, setStateQuery] = useState("")
  const [showStateDropdown, setShowStateDropdown] = useState(false)

  // Get states that are used in OTHER zones (not this zone)
  const statesUsedElsewhere = useMemo(() => {
    const thisZoneStates = new Set(zone.states.map((s) => s.toUpperCase()))
    const usedElsewhere = new Set<string>()
    usedStates.forEach((state) => {
      if (!thisZoneStates.has(state.toUpperCase())) {
        usedElsewhere.add(state.toUpperCase())
      }
    })
    return usedElsewhere
  }, [zone.states, usedStates])

  const filteredStates = useMemo(() => {
    if (!stateQuery.trim()) return []
    const query = stateQuery.toLowerCase()
    return US_STATES.filter(
      (s) =>
        // Not already in this zone
        !zone.states.some((zs) => zs.toUpperCase() === s.code.toUpperCase()) &&
        // Not used in another zone
        !statesUsedElsewhere.has(s.code.toUpperCase()) &&
        (s.code.toLowerCase().includes(query) ||
          s.name.toLowerCase().includes(query))
    ).slice(0, 10)
  }, [stateQuery, zone.states, statesUsedElsewhere])

  const addState = (state: (typeof US_STATES)[0]) => {
    onZoneChange({
      ...zone,
      states: [...zone.states, state.code],
    })
    setStateQuery("")
    setShowStateDropdown(false)
  }

  const removeState = (stateCode: string) => {
    onZoneChange({
      ...zone,
      states: zone.states.filter((s) => s.toUpperCase() !== stateCode.toUpperCase()),
    })
  }

  return (
    <tr className="border-b border-slate-200 last:border-b-0">
      {/* Zone Name */}
      <td className="py-3 px-2 align-top">
        <input
          type="text"
          className={`${CONTROL_CLASSES} min-w-[120px]`}
          value={zone.name}
          onChange={(e) => onZoneChange({ ...zone, name: e.target.value })}
          placeholder="Zone name"
        />
      </td>

      {/* Origin Repo Time */}
      <td className="py-3 px-2 align-top">
        <input
          type="number"
          className={`${CONTROL_CLASSES} w-20`}
          value={times.originRepoTime}
          min={0}
          step={0.1}
          onChange={(e) =>
            onTimesChange({
              ...times,
              originRepoTime: parseFloat(e.target.value) || 0,
            })
          }
        />
      </td>

      {/* Destination Repo Time */}
      <td className="py-3 px-2 align-top">
        <input
          type="number"
          className={`${CONTROL_CLASSES} w-20`}
          value={times.destinationRepoTime}
          min={0}
          step={0.1}
          onChange={(e) =>
            onTimesChange({
              ...times,
              destinationRepoTime: parseFloat(e.target.value) || 0,
            })
          }
        />
      </td>

      {/* Zone States */}
      <td className="py-3 px-2 align-top">
        <div className="relative">
          <input
            type="text"
            className={`${CONTROL_CLASSES} min-w-[200px]`}
            placeholder="Search states..."
            value={stateQuery}
            onChange={(e) => {
              setStateQuery(e.target.value)
              setShowStateDropdown(true)
            }}
            onFocus={() => setShowStateDropdown(true)}
            onBlur={() =>
              setTimeout(() => setShowStateDropdown(false), 150)
            }
          />
          {showStateDropdown && filteredStates.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
              {filteredStates.map((state) => (
                <button
                  key={state.code}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                  onMouseDown={() => addState(state)}
                >
                  <span className="font-semibold">{state.code}</span>
                  <span className="text-slate-500 ml-2">
                    {state.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {zone.states.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {zone.states.map((stateCode) => (
              <span
                key={stateCode}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"
              >
                {stateCode}
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-600"
                  onClick={() => removeState(stateCode)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </td>

      {/* Delete */}
      <td className="py-3 px-2 align-top">
        <button
          type="button"
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
          onClick={onDelete}
        >
          <FiTrash2 className="h-4 w-4" />
        </button>
      </td>
    </tr>
  )
}

export function ZonesEditor({
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
  const config: ZoneNetworkConfig = useMemo(() => {
    if (value && typeof value === "object") {
      const v = value as Partial<ZoneNetworkConfig>
      return {
        zones: v.zones ?? [],
        zoneRepoTimes: v.zoneRepoTimes ?? [],
        peakPeriods: v.peakPeriods ?? [],
        selectionMethod: "closest_in_zone" as const,
      }
    }
    return {
      zones: [],
      zoneRepoTimes: [],
      peakPeriods: [],
      selectionMethod: "closest_in_zone" as const,
    }
  }, [value])

  const addZone = () => {
    const newZoneId = generateZoneId()
    const newZone: Zone = {
      id: newZoneId,
      name: `Zone ${config.zones.length + 1}`,
      states: [],
    }
    const newTimes: ZoneRepoTimes = {
      zoneId: newZoneId,
      originRepoTime: 0,
      destinationRepoTime: 0,
    }
    onChangeAction({
      ...config,
      zones: [...config.zones, newZone],
      zoneRepoTimes: [...config.zoneRepoTimes, newTimes],
    })
  }

  // Collect all states used across all zones
  const usedStates = useMemo(() => {
    const used = new Set<string>()
    config.zones.forEach((zone) => {
      zone.states.forEach((state) => {
        used.add(state.toUpperCase())
      })
    })
    return used
  }, [config.zones])

  const updateZone = (zoneId: string, updatedZone: Zone) => {
    onChangeAction({
      ...config,
      zones: config.zones.map((z) => (z.id === zoneId ? updatedZone : z)),
    })
  }

  const updateTimes = (zoneId: string, updatedTimes: ZoneRepoTimes) => {
    onChangeAction({
      ...config,
      zoneRepoTimes: config.zoneRepoTimes.map((t) =>
        t.zoneId === zoneId ? updatedTimes : t
      ),
    })
  }

  const deleteZone = (zoneId: string) => {
    onChangeAction({
      ...config,
      zones: config.zones.filter((z) => z.id !== zoneId),
      zoneRepoTimes: config.zoneRepoTimes.filter((t) => t.zoneId !== zoneId),
    })
  }

  return (
    <div className="mb-4 w-full">
      <label className="block text-sm font-semibold text-slate-700 mb-1 group inline-flex items-center">
        {label}
        {help && <HelpIcon text={help} />}
      </label>

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {config.zones.length === 0 ? (
          <div className="text-center py-8 text-slate-500 bg-slate-50">
            <p className="text-sm mb-4">No zones configured yet.</p>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              onClick={addZone}
            >
              <FiPlus /> Add First Zone
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="py-2 px-2 text-left">
                      <span className={LABEL_CLASSES}>Zone Name</span>
                    </th>
                    <th className="py-2 px-2 text-left">
                      <span className={`${LABEL_CLASSES} inline-flex items-center`}>
                        Origin Time (hrs)
                        <HelpIcon text="Hours to add when aircraft repos FROM this zone (outbound)." />
                      </span>
                    </th>
                    <th className="py-2 px-2 text-left">
                      <span className={`${LABEL_CLASSES} inline-flex items-center`}>
                        Dest Time (hrs)
                        <HelpIcon text="Hours to add when aircraft repos TO this zone (inbound)." />
                      </span>
                    </th>
                    <th className="py-2 px-2 text-left">
                      <span className={LABEL_CLASSES}>Zone States</span>
                    </th>
                    <th className="py-2 px-2 w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {config.zones.map((zone) => {
                    const times = config.zoneRepoTimes.find(
                      (t) => t.zoneId === zone.id
                    ) ?? {
                      zoneId: zone.id,
                      originRepoTime: 0,
                      destinationRepoTime: 0,
                    }
                    return (
                      <ZoneRow
                        key={zone.id}
                        zone={zone}
                        times={times}
                        onZoneChange={(z) => updateZone(zone.id, z)}
                        onTimesChange={(t) => updateTimes(zone.id, t)}
                        onDelete={() => deleteZone(zone.id)}
                        usedStates={usedStates}
                      />
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-3 bg-slate-50 border-t border-slate-200">
              <button
                type="button"
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
                onClick={addZone}
              >
                <FiPlus /> Add Zone
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
