"use client"

import dayjs from "dayjs"
import React, { useEffect, useMemo, useState } from "react"
import "react-big-calendar/lib/css/react-big-calendar.css"
import "@/app/ical/IcalPage.css"
import timezone from "dayjs/plugin/timezone"
import { useSearchParams } from "next/navigation"
import { fetchIcalEvents } from "@/app/ical/IcalService.client"
import type { IcalEvent } from "@/app/ical/IcalTypes"
import { Calendar, Views, dayjsLocalizer } from "react-big-calendar"
import { EventDetail, type CalendarEventDetail } from "@/app/ical/EventDetail"

dayjs.extend(timezone)
const localizer = dayjsLocalizer(dayjs)

type CalendarEvent = CalendarEventDetail & {
  title: string
}

export const IcalPage = () => {
  const searchParams = useSearchParams()
  const icalUrl = useMemo(
    () => searchParams.get("ical")?.trim() ?? "",
    [searchParams]
  )
  const [events, setEvents] = useState<IcalEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0)
  const [view, setView] = useState<(typeof Views)[keyof typeof Views]>(
    Views.AGENDA
  )
  const [currentDate, setCurrentDate] = useState(new Date())
  const [tails, setTails] = useState<string[]>([])
  const [filterTail, setFilterTail] = useState<string | null>(null)

  useEffect(() => {
    const schedule = (action: () => void) => {
      queueMicrotask(() => {
        action()
      })
    }
    if (!icalUrl) {
      schedule(() => {
        setEvents([])
        setError(null)
        setLoading(false)
      })
      return
    }
    const loadEvents = async () => {
      schedule(() => {
        setLoading(true)
        setError(null)
      })
      try {
        const data = await fetchIcalEvents(icalUrl)
        setEvents(data)
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load iCal.")
        setEvents([])
      } finally {
        setLoading(false)
      }
    }
    loadEvents()
  }, [icalUrl])

  const loadingMessages = useMemo(
    () => [
      "Time-traveling through the schedule…",
      "Shuffling aircraft into the right places…",
      "Finding opportunities between flights…",
      "Spotting must-move legs…",
      "Turning calendar data into flight plans…",
      "Double-checking the dominoes line up…",
      "Making the schedule behave…",
    ],
    []
  )

  useEffect(() => {
    if (!loading) return
    let timeoutId: number | null = null
    const cycle = () => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length)
      const nextDelay = 900 + Math.floor(Math.random() * 1400)
      timeoutId = window.setTimeout(cycle, nextDelay)
    }
    const initialDelay = 800 + Math.floor(Math.random() * 1200)
    timeoutId = window.setTimeout(cycle, initialDelay)
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [loading, loadingMessages.length])

  useEffect(() => {
    if (events.length === 0) {
      setTails([])
      setFilterTail(null)
      return
    }
    const extractedTails = Array.from(
      new Set(
        events
          .map((event) => event.tailNumber)
          .filter((tail): tail is string => Boolean(tail && tail.length > 0))
      )
    ).sort()
    const tailsWithAll = ["All", ...extractedTails]
    setTails(tailsWithAll)
    if (!filterTail && extractedTails.length > 0) {
      setFilterTail(extractedTails[0])
    }
  }, [events, filterTail])

  const filteredEvents = useMemo(() => {
    if (!filterTail || filterTail === "All") return events
    return events.filter((event) => event.tailNumber === filterTail)
  }, [events, filterTail])

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    return filteredEvents
      .map((event) => {
        const start = new Date(event.start)
        const end = new Date(event.end)
        if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
          return null
        }
        return {
          ...event,
          title: event.eventSummary,
          start,
          end,
        }
      })
      .filter((event): event is CalendarEvent => Boolean(event))
  }, [filteredEvents])

  const eventStyleGetter = (event: CalendarEvent) => {
    const title = event.eventSummary
    let backgroundColor = "transparent"
    if (title.includes("Maintenance")) {
      backgroundColor = "orange"
    } else if (title.includes("Owner hold")) {
      backgroundColor = "red"
    } else if (title.includes("Charter flight")) {
      backgroundColor = "red"
    } else if (title.includes("Aircraft away from home base")) {
      backgroundColor = "#3CB371"
    } else if (title.includes("Positioning flight")) {
      backgroundColor = "green"
    } else if (title.includes("Aircraft needs repositioning")) {
      backgroundColor = "#8FBC8B"
    } else if (title.includes("Aircraft at home base - generated")) {
      backgroundColor = "#55AA73"
    }
    const style: React.CSSProperties = {
      backgroundColor,
      color: backgroundColor === "transparent" ? "black" : "white",
    }
    if (event.mustMove) {
      style.backgroundColor = "transparent"
      style.backgroundImage =
        "linear-gradient(132deg, #000000, #1e90ff, #00bfff, #0000ff, #C2185B)"
      style.backgroundSize = "400% 400%"
      style.animation = "BackgroundGradient 5s ease infinite"
      style.color = "white"
    } else if (event.isGoodwinEmptyLeg) {
      style.backgroundColor = "transparent"
      style.backgroundImage =
        "linear-gradient(100deg, #FFF3B0, #FFD6E7, #FFE08A, #F9C0D9, #E8F5FF)"
      style.backgroundSize = "400% 400%"
      style.animation = "BackgroundGradient 8s ease infinite"
      style.color = "black"
    }
    return { style }
  }

  return (
    <div className="px-6">
      <div className="text-lg font-semibold text-slate-800 mb-2">
        iCal Schedule
      </div>
      {icalUrl ? (
        <div className="mb-4 break-words text-xs text-slate-500">{icalUrl}</div>
      ) : (
        <div className="mb-4 text-sm text-slate-500">
          Provide an iCal link to load events.
        </div>
      )}
      {loading && (
        <div className="flex h-[60vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700" />
            <div className="text-sm font-semibold text-black">
              {loadingMessages[loadingMessageIndex]}
            </div>
          </div>
        </div>
      )}
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {!loading && !error && calendarEvents.length === 0 && icalUrl && (
        <div className="text-sm text-slate-500">No events found.</div>
      )}
      {!loading && !error && calendarEvents.length > 0 && (
        <div className="h-[80vh] min-h-[600px] overflow-auto">
          {tails.length > 0 && (
            <div className="mb-3 max-w-xs">
              <label className="mb-1 block text-xs font-semibold text-slate-500">
                Tail
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm transition focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
                value={filterTail ?? ""}
                onChange={(event) => {
                  const value = event.target.value
                  setFilterTail(value || null)
                }}
              >
                {tails.map((tail) => (
                  <option key={tail} value={tail}>
                    {tail}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Calendar
            className="h-full"
            events={calendarEvents}
            localizer={localizer}
            step={60}
            view={view}
            date={currentDate}
            onView={(nextView) => setView(nextView)}
            views={[Views.MONTH, Views.WEEK, Views.DAY, Views.AGENDA]}
            onNavigate={(date: Date) => {
              setCurrentDate(new Date(date))
            }}
            eventPropGetter={eventStyleGetter}
            components={{ event: EventComponent }}
          />
        </div>
      )}
    </div>
  )
}
  const EventComponent: React.FC<{ event: CalendarEvent }> = ({ event }) => {
    const title = event.title ?? event.eventSummary
    const shouldShowPopover = Boolean(event.mustMove || event.isGoodwinEmptyLeg)
    if (!shouldShowPopover) {
      return <div className="h-full w-full">{title}</div>
    }
    return <EventDetail event={event} title={title} />
  }
