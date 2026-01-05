import type { IcalEvent } from "@/app/ical/IcalTypes"

type IcalResponse = {
  events: IcalEvent[]
}

export async function fetchIcalEvents(icalUrl: string): Promise<IcalEvent[]> {
  if (!icalUrl.trim()) return []
  const response = await fetch(`/api/ical?ical=${encodeURIComponent(icalUrl)}`)
  if (!response.ok) {
    throw new Error(`Failed to load iCal events (${response.status}).`)
  }
  const data = (await response.json()) as IcalResponse
  return data.events ?? []
}
