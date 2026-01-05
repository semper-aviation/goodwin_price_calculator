import dayjs from "dayjs"
import ical from "node-ical"
import type { IcalEvent } from "@/app/ical/IcalTypes"

export function extractAircraft(summary?: string): string | null {
  const match = summary?.match(/\[(.*?)\]/)
  return match ? match[1] : null
}

export function extractAirport(index: number, summary?: string): string | null {
  const match = summary?.match(/\((.*?) - (.*?)\)/)
  return match ? match[index] : null
}

/**
 * Extracts the event type from the SUMMARY field
 * Event type is the text after the final " - "
 * Example: "[N444QC] Charter (ECP - PBI) - Positioning flight" => "Positioning flight"
 */
export function extractEventType(summary?: string): string | null {
  if (!summary) return null
  const lastDashIndex = summary.lastIndexOf(" - ")
  if (lastDashIndex === -1) return null
  return summary.substring(lastDashIndex + 3).trim()
}

/**
 * Constructs a unique event key for an event
 */
export function getEventKey(event: {
  tailNumber: string
  fromIcao: string
  toIcao: string
  start: Date | string
}) {
  return `${event.tailNumber}-${event.fromIcao}-${event.toIcao}-${dayjs(
    event.start
  ).toISOString()}`
}

type ParsedEvent = {
  tailNumber: string | null
  eventSummary: string
  start: Date
  end: Date
  fromIcao: string
  toIcao: string
  eventType: string | null
}

type ParsedEventWithTail = Omit<ParsedEvent, "tailNumber"> & {
  tailNumber: string
}

type EmptyLegWithFlexibility = ParsedEventWithTail & {
  mustArriveBy: Date | null
  earliestDeparture: Date | null
  mustDepartBy: Date | null
  mustMove: boolean
  flightTimeMinutes: number
}

function identifyEmptyLegs(
  events: ParsedEventWithTail[]
): EmptyLegWithFlexibility[] {
  const now = dayjs()
  const threeDaysFromNow = now.add(3, "day")
  const mustMoveThresholdMinutes = 60

  const eventsByTail = new Map<string, ParsedEventWithTail[]>()
  events.forEach((event) => {
    if (!eventsByTail.has(event.tailNumber)) {
      eventsByTail.set(event.tailNumber, [])
    }
    eventsByTail.get(event.tailNumber)?.push(event)
  })

  eventsByTail.forEach((tailEvents) => {
    tailEvents.sort((a, b) => a.start.getTime() - b.start.getTime())
  })

  const emptyLegs: EmptyLegWithFlexibility[] = []

  eventsByTail.forEach((tailEvents) => {
    for (let i = 0; i < tailEvents.length; i += 1) {
      const currentEvent = tailEvents[i]
      const eventStart = dayjs(currentEvent.start)

      if (
        currentEvent.eventType !== "Positioning flight" ||
        !eventStart.isAfter(now) ||
        !eventStart.isBefore(threeDaysFromNow)
      ) {
        continue
      }

      let charterBefore: ParsedEventWithTail | null = null
      for (let j = i - 1; j >= 0; j -= 1) {
        if (
          tailEvents[j].eventType === "Charter flight" &&
          dayjs(tailEvents[j].end).isBefore(dayjs(currentEvent.start))
        ) {
          charterBefore = tailEvents[j]
          break
        }
      }

      let charterAfter: ParsedEventWithTail | null = null
      for (let j = i + 1; j < tailEvents.length; j += 1) {
        if (
          tailEvents[j].eventType === "Charter flight" &&
          dayjs(tailEvents[j].start).isAfter(dayjs(currentEvent.end))
        ) {
          charterAfter = tailEvents[j]
          break
        }
      }

      if (!charterBefore || !charterAfter) {
        continue
      }

      const originMatches = currentEvent.fromIcao === charterBefore.toIcao
      const destinationMatches = currentEvent.toIcao === charterAfter.fromIcao

      if (!originMatches || !destinationMatches) {
        continue
      }

      const flightTimeMinutes = dayjs(currentEvent.end).diff(
        dayjs(currentEvent.start),
        "minute"
      )

      const mustArriveBy = charterAfter
        ? dayjs(charterAfter.start).subtract(60, "minute").toDate()
        : null
      const earliestDeparture = charterBefore
        ? dayjs(charterBefore.end).add(60, "minute").toDate()
        : null
      const mustDepartBy = mustArriveBy
        ? dayjs(mustArriveBy).subtract(flightTimeMinutes, "minute").toDate()
        : null
      const mustMove = flightTimeMinutes > mustMoveThresholdMinutes

      emptyLegs.push({
        ...currentEvent,
        mustArriveBy,
        earliestDeparture,
        mustDepartBy,
        mustMove,
        flightTimeMinutes,
      })
    }
  })

  return emptyLegs
}

export async function parseIcalUrl(icalUrl: string): Promise<IcalEvent[]> {
  const data = await ical.fromURL(icalUrl)
  const now = dayjs()
  const events = Object.values(data)
    .filter(
      (item) => item && typeof item === "object" && item.type === "VEVENT"
    )
    .map((event) => {
      const eventData = event as {
        start: Date
        end: Date
        summary?: string
      }
      const endDate = dayjs(eventData.end)
      if (endDate.diff(now, "day") < -2) return null
      const summary = eventData.summary ?? ""
      return {
        tailNumber: extractAircraft(summary),
        eventSummary: summary,
        start: new Date(eventData.start),
        end: new Date(eventData.end),
        fromIcao: extractAirport(1, summary) || "",
        toIcao: extractAirport(2, summary) || "",
        eventType: extractEventType(summary),
      } satisfies ParsedEvent
    })
    .filter((event): event is ParsedEvent => Boolean(event))

  const eventsWithTail = events.filter((event): event is ParsedEventWithTail =>
    Boolean(event.tailNumber)
  )
  const emptyLegs = identifyEmptyLegs(eventsWithTail)
  const emptyLegMap = new Map<string, EmptyLegWithFlexibility>()
  emptyLegs.forEach((leg) => {
    emptyLegMap.set(getEventKey(leg), leg)
  })

  return events.map((event) => {
    const match = event.tailNumber
      ? emptyLegMap.get(getEventKey(event as ParsedEventWithTail))
      : undefined
    return {
      tailNumber: event.tailNumber,
      eventSummary: event.eventSummary,
      start: event.start.toISOString(),
      end: event.end.toISOString(),
      fromIcao: event.fromIcao,
      toIcao: event.toIcao,
      eventType: event.eventType,
      isGoodwinEmptyLeg: Boolean(match),
      mustMove: match?.mustMove,
      mustArriveBy: match?.mustArriveBy?.toISOString() ?? null,
      earliestDeparture: match?.earliestDeparture?.toISOString() ?? null,
      mustDepartBy: match?.mustDepartBy?.toISOString() ?? null,
      flightTimeMinutes: match?.flightTimeMinutes,
    } satisfies IcalEvent
  })
}
