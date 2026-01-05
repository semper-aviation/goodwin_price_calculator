export type IcalEvent = {
  tailNumber: string | null
  eventSummary: string
  start: string
  end: string
  fromIcao: string
  toIcao: string
  eventType: string | null
  isGoodwinEmptyLeg?: boolean
  mustMove?: boolean
  mustArriveBy?: string | null
  earliestDeparture?: string | null
  mustDepartBy?: string | null
  flightTimeMinutes?: number
}
