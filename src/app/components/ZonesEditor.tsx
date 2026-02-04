"use client"

import React, { useState, useMemo } from "react"
import { FiInfo, FiPlus, FiTrash2, FiChevronDown, FiChevronUp } from "react-icons/fi"
import airportsData from "../data/airports"
import type { Airport } from "../engine/quoteRequest"

// Types matching the engine types
type Zone = {
  id: string
  name: string
  airports: Airport[]
}

type ZoneRepoRates = {
  zoneId: string
  originRepoRate: number
  destinationRepoRate: number
}

type ZoneNetworkConfig = {
  zones: Zone[]
  zoneRepoRates: ZoneRepoRates[]
  peakPeriods?: unknown[]
  selectionMethod: "closest_in_zone"
}

const CONTROL_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
const LABEL_CLASSES = "block text-sm font-semibold text-slate-700 mb-1"

function generateZoneId(): string {
  return `zone_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
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

function ZoneCard({
  zone,
  rates,
  onZoneChange,
  onRatesChange,
  onDelete,
  expanded,
  onToggleExpand,
  usedAirports,
}: {
  zone: Zone
  rates: ZoneRepoRates
  onZoneChange: (zone: Zone) => void
  onRatesChange: (rates: ZoneRepoRates) => void
  onDelete: () => void
  expanded: boolean
  onToggleExpand: () => void
  usedAirports: Set<string>
}) {
  const [airportQuery, setAirportQuery] = useState("")
  const [showAirportDropdown, setShowAirportDropdown] = useState(false)

  // Get airports that are used in OTHER zones (not this zone)
  const airportsUsedElsewhere = useMemo(() => {
    const thisZoneIcaos = new Set(zone.airports.map((a) => a.icao))
    const usedElsewhere = new Set<string>()
    usedAirports.forEach((icao) => {
      if (!thisZoneIcaos.has(icao)) {
        usedElsewhere.add(icao)
      }
    })
    return usedElsewhere
  }, [zone.airports, usedAirports])

  const filteredAirports = useMemo(() => {
    if (!airportQuery.trim()) return []
    const query = airportQuery.toLowerCase()
    return airportsData
      .filter(
        (a) =>
          // Not already in this zone
          !zone.airports.some((za) => za.icao === a.icao) &&
          // Not used in another zone
          !airportsUsedElsewhere.has(a.icao) &&
          (a.icao.toLowerCase().includes(query) ||
            a.name?.toLowerCase().includes(query) ||
            a.city?.toLowerCase().includes(query) ||
            a.state?.toLowerCase().includes(query))
      )
      .slice(0, 10)
  }, [airportQuery, zone.airports, airportsUsedElsewhere])

  const addAirport = (airport: (typeof airportsData)[0]) => {
    const newAirport: Airport = {
      icao: airport.icao,
      lat: airport.lat,
      lon: airport.lon,
      country: airport.country,
      state: airport.state,
      mississippi_direction: airport.mississippi_direction as "EAST" | "WEST",
      timezoneId: airport.timezone_id,
    }
    onZoneChange({
      ...zone,
      airports: [...zone.airports, newAirport],
    })
    setAirportQuery("")
    setShowAirportDropdown(false)
  }

  const removeAirport = (icao: string) => {
    onZoneChange({
      ...zone,
      airports: zone.airports.filter((a) => a.icao !== icao),
    })
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white mb-3">
      {/* Header */}
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
              {zone.name || "Unnamed Zone"}
            </div>
            <div className="text-xs text-slate-500">
              {zone.airports.length} airports | Origin: $
              {rates.originRepoRate.toLocaleString()}/hr | Dest: $
              {rates.destinationRepoRate.toLocaleString()}/hr
            </div>
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

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-slate-100 p-4 space-y-4">
          {/* Zone name */}
          <div>
            <label className={LABEL_CLASSES}>Zone Name</label>
            <input
              type="text"
              className={CONTROL_CLASSES}
              value={zone.name}
              onChange={(e) => onZoneChange({ ...zone, name: e.target.value })}
              placeholder="e.g., East Zone, West Zone"
            />
          </div>

          {/* Rates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLASSES}>
                Origin Repo Rate ($/hr)
                <HelpIcon text="Rate charged when a repo leg STARTS from an airport in this zone (outbound repo)." />
              </label>
              <input
                type="number"
                className={CONTROL_CLASSES}
                value={rates.originRepoRate}
                min={0}
                step={100}
                onChange={(e) =>
                  onRatesChange({
                    ...rates,
                    originRepoRate: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div>
              <label className={LABEL_CLASSES}>
                Destination Repo Rate ($/hr)
                <HelpIcon text="Rate charged when a repo leg ENDS at an airport in this zone (inbound repo)." />
              </label>
              <input
                type="number"
                className={CONTROL_CLASSES}
                value={rates.destinationRepoRate}
                min={0}
                step={100}
                onChange={(e) =>
                  onRatesChange({
                    ...rates,
                    destinationRepoRate: parseFloat(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>

          {/* Airports */}
          <div>
            <label className={LABEL_CLASSES}>Zone Airports</label>
            <div className="relative">
              <input
                type="text"
                className={CONTROL_CLASSES}
                placeholder="Search and add airports..."
                value={airportQuery}
                onChange={(e) => {
                  setAirportQuery(e.target.value)
                  setShowAirportDropdown(true)
                }}
                onFocus={() => setShowAirportDropdown(true)}
                onBlur={() =>
                  setTimeout(() => setShowAirportDropdown(false), 150)
                }
              />
              {showAirportDropdown && filteredAirports.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                  {filteredAirports.map((airport) => (
                    <button
                      key={airport.icao}
                      type="button"
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                      onMouseDown={() => addAirport(airport)}
                    >
                      <span className="font-semibold">{airport.icao}</span>
                      <span className="text-slate-500 ml-2">
                        {airport.name} ({airport.city}, {airport.state})
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {zone.airports.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {zone.airports.map((airport) => (
                  <span
                    key={airport.icao}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700"
                  >
                    {airport.icao}
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600"
                      onClick={() => removeAirport(airport.icao)}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            {zone.airports.length === 0 && (
              <p className="mt-2 text-xs text-slate-500">
                No airports added. Search and add airports above.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
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
  const [expandedZoneIds, setExpandedZoneIds] = useState<Set<string>>(new Set())

  const config: ZoneNetworkConfig = useMemo(() => {
    if (value && typeof value === "object") {
      const v = value as Partial<ZoneNetworkConfig>
      return {
        zones: v.zones ?? [],
        zoneRepoRates: v.zoneRepoRates ?? [],
        peakPeriods: v.peakPeriods ?? [],
        selectionMethod: "closest_in_zone" as const,
      }
    }
    return {
      zones: [],
      zoneRepoRates: [],
      peakPeriods: [],
      selectionMethod: "closest_in_zone" as const,
    }
  }, [value])

  const addZone = () => {
    const newZoneId = generateZoneId()
    const newZone: Zone = {
      id: newZoneId,
      name: `Zone ${config.zones.length + 1}`,
      airports: [],
    }
    const newRates: ZoneRepoRates = {
      zoneId: newZoneId,
      originRepoRate: 0,
      destinationRepoRate: 0,
    }
    onChangeAction({
      ...config,
      zones: [...config.zones, newZone],
      zoneRepoRates: [...config.zoneRepoRates, newRates],
    })
    setExpandedZoneIds((prev) => new Set(prev).add(newZoneId))
  }

  // Collect all airports used across all zones
  const usedAirports = useMemo(() => {
    const used = new Set<string>()
    config.zones.forEach((zone) => {
      zone.airports.forEach((airport) => {
        used.add(airport.icao)
      })
    })
    return used
  }, [config.zones])

  const toggleZoneExpand = (zoneId: string) => {
    setExpandedZoneIds((prev) => {
      const next = new Set(prev)
      if (next.has(zoneId)) {
        next.delete(zoneId)
      } else {
        next.add(zoneId)
      }
      return next
    })
  }

  const updateZone = (zoneId: string, updatedZone: Zone) => {
    onChangeAction({
      ...config,
      zones: config.zones.map((z) => (z.id === zoneId ? updatedZone : z)),
    })
  }

  const updateRates = (zoneId: string, updatedRates: ZoneRepoRates) => {
    onChangeAction({
      ...config,
      zoneRepoRates: config.zoneRepoRates.map((r) =>
        r.zoneId === zoneId ? updatedRates : r
      ),
    })
  }

  const deleteZone = (zoneId: string) => {
    onChangeAction({
      ...config,
      zones: config.zones.filter((z) => z.id !== zoneId),
      zoneRepoRates: config.zoneRepoRates.filter((r) => r.zoneId !== zoneId),
    })
  }

  return (
    <div className="mb-4 w-full">
      <label
        className={`${LABEL_CLASSES} group inline-flex items-center`}
      >
        {label}
        {help && <HelpIcon text={help} />}
      </label>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        {config.zones.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
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
            {config.zones.map((zone) => {
              const rates = config.zoneRepoRates.find(
                (r) => r.zoneId === zone.id
              ) ?? {
                zoneId: zone.id,
                originRepoRate: 0,
                destinationRepoRate: 0,
              }
              return (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  rates={rates}
                  onZoneChange={(z) => updateZone(zone.id, z)}
                  onRatesChange={(r) => updateRates(zone.id, r)}
                  onDelete={() => deleteZone(zone.id)}
                  expanded={expandedZoneIds.has(zone.id)}
                  onToggleExpand={() => toggleZoneExpand(zone.id)}
                  usedAirports={usedAirports}
                />
              )
            })}
            <button
              type="button"
              className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:border-slate-400 hover:bg-slate-50"
              onClick={addZone}
            >
              <FiPlus /> Add Zone
            </button>
          </>
        )}
      </div>
    </div>
  )
}
