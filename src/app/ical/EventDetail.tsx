"use client"

import dayjs from "dayjs"
import utc from "dayjs/plugin/utc"
import React, { useEffect, useRef, useState } from "react"
import type { IcalEvent } from "@/app/ical/IcalTypes"

dayjs.extend(utc)

export type CalendarEventDetail = Omit<IcalEvent, "start" | "end"> & {
  start: Date
  end: Date
}

type EventDetailProps = {
  event: CalendarEventDetail
  title: string
}

function formatUtc(value?: string | Date | null) {
  if (!value) return "—"
  return dayjs(value).utc().format("MMM D, YYYY h:mm A")
}

export function EventDetail({ event, title }: EventDetailProps) {
  const [open, setOpen] = useState(false)
  const openTimer = useRef<number | null>(null)
  const closeTimer = useRef<number | null>(null)

  const scheduleOpen = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    openTimer.current = window.setTimeout(() => setOpen(true), 120)
  }

  const scheduleClose = () => {
    if (openTimer.current) window.clearTimeout(openTimer.current)
    closeTimer.current = window.setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => {
    return () => {
      if (openTimer.current) window.clearTimeout(openTimer.current)
      if (closeTimer.current) window.clearTimeout(closeTimer.current)
    }
  }, [])

  return (
    <div
      className="relative block h-full w-full"
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={scheduleClose}
      onClick={(eventClick) => {
        eventClick.stopPropagation()
        setOpen(true)
      }}
      tabIndex={0}
    >
      {title}
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg"
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          onClick={(eventClick) => eventClick.stopPropagation()}
        >
          <div className="mb-1 text-sm font-semibold text-slate-800">
            {title}
          </div>
          <div className="mb-1">
            <span className="font-semibold">Tail: </span>
            {event.tailNumber || "—"}
          </div>
          <div className="mb-1">
            <span className="font-semibold">Route: </span>
            {event.fromIcao} → {event.toIcao}
          </div>
          <div className="mb-1">
            <span className="font-semibold">Start (UTC): </span>
            {formatUtc(event.start)}
          </div>
          <div className="mb-1">
            <span className="font-semibold">End (UTC): </span>
            {formatUtc(event.end)}
          </div>
          <div className="mb-1">
            <span className="font-semibold">Must arrive by (UTC): </span>
            {formatUtc(event.mustArriveBy)}
          </div>
          <div className="mb-1">
            <span className="font-semibold">Earliest departure (UTC): </span>
            {formatUtc(event.earliestDeparture)}
          </div>
          <div className="mb-1">
            <span className="font-semibold">Must depart by (UTC): </span>
            {formatUtc(event.mustDepartBy)}
          </div>
          {event.mustMove && (
            <div className="mb-1">
              <span className="font-semibold">Must move: </span>Yes
            </div>
          )}
          {event.isGoodwinEmptyLeg && (
            <div className="mb-1">
              <span className="font-semibold">Goodwin empty leg: </span>Yes
            </div>
          )}
        </div>
      )}
    </div>
  )
}
