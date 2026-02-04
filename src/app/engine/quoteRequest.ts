export type FlightLegInput = {
  originIcao: string
  destinationIcao: string
  departDate: string
  departTime?: string
  originLat: number
  originLon: number
  destinationLat: number
  destinationLon: number
}

export type ICalculatedFlightTime = {
  durationDetails: Array<{
    originIcao: string
    destinationIcao: string
    departDate: string
    departTime?: string
    durationSec: number
  }>
}

export type TripType = "ONE_WAY" | "ROUND_TRIP"
export type CategoryId =
  | "CAT1"
  | "CAT2"
  | "CAT3"
  | "CAT4"
  | "CAT5"
  | "CAT6"
  | "CAT7"
  | "CAT8"

export type Airport = {
  icao: string
  lat: number
  lon: number
  country?: string
  state?: string
  mississippi_direction: "EAST" | "WEST"
  timezoneId: string
}

// Zone Network Types
export type Zone = {
  id: string
  name: string
  states: string[] // US state codes (e.g., "NY", "CA", "FL")
}

export type ZoneRepoTimes = {
  zoneId: string
  originRepoTime: number      // hours to add for outbound repo FROM this zone
  destinationRepoTime: number // hours to add for inbound repo TO this zone
}

export type PeakPeriod = {
  id: string
  name: string
  startDate: string // YYYY-MM-DD
  endDate: string // YYYY-MM-DD
  zoneTimeOverrides?: Array<{
    zoneId: string
    originRepoTime: number      // override origin repo time during peak
    destinationRepoTime: number // override destination repo time during peak
  }>
  repoRateMultiplier?: number   // multiplier for repo rate during peak (e.g., 1.25 = 25% increase)
  occupiedMultiplier?: number   // multiplier for occupied rate during peak
}

export type ZoneNetworkConfig = {
  zones: Zone[]
  zoneRepoTimes: ZoneRepoTimes[]
  peakPeriods?: PeakPeriod[]
  selectionMethod: "closest_in_zone"
}

export type TripInput = {
  tripType: TripType
  category: CategoryId
  aircraftModelId?: string
  from: Airport
  to: Airport
  departLocalISO: string
  departTimezone?: string
  returnLocalISO?: string
  returnTimezone?: string
  passengers?: number
}

export type PricingKnobs = {
  trip?: {
    maxNightsBeforeSplit?: number
  }
  repo: {
    mode: "fixed_base" | "vhb_network" | "floating_fleet" | "zone_network"
    policy: "both" | "outbound_only" | "inbound_only"
    fixedBaseIcao?: Airport
    vhbSets?: {
      default?: Airport[]
      byCategory?: Partial<Record<CategoryId, string[]>>
    }
    vhbSelection: "closest_by_distance"
    zoneNetwork?: ZoneNetworkConfig
    constraints?: {
      maxOriginRepoHours?: number
      maxDestinationRepoHours?: number
      rejectIfExceeded?: boolean
    }
  }
  time: {
    taxiHoursPerLeg: number
    bufferHoursPerLeg: number
    applyTo: "occupied" | "repo" | "both"
    minimums?: {
      minActualFlightHoursPerLeg?: number
      minFirstOccupiedLegHours?: number
      minTotalTripHours?: number
      minOccupiedHoursTotal?: number
    }
    dailyLimits?: {
      maxOccupiedHoursPerDay?: number
      rejectIfExceeded?: boolean
      rejectIfAnyLegExceeds?: number
      rejectIfSameDayRoundTripExceeds?: number
    }
  }
  pricing: {
    currency: "USD"
    rateModel: "single_hourly" | "dual_rate_repo_occupied" | "zone_based"
    hourlyRate?: number
    repoRate?: number
    occupiedRate?: number
  }
  discounts: {
    vhbDiscount?: {
      mode: "none" | "origin_or_destination" | "both_required"
      percent: number
      appliesTo: "base_only" | "subtotal_before_fees" | "total"
    }
    timeBasedDiscount?: {
      enabled: boolean
      minOccupiedHoursPerLeg: number
      discountPercent: number
      appliesTo: "base_only" | "subtotal_before_fees" | "total"
    }
  }
  scoring?: {
    matchScore?: {
      enabled: boolean
      threshold: number
      action: "reject" | "rank_only"
    }
  }
  fees: {
    groundHandling?: {
      perSegmentAmount: number
      appliesTo: "occupied_only" | "all_legs"
    }
    highDensity?: {
      airports: Airport[]
      feePerVisit: number
      countingMode: "segment_endpoints" | "arrivals_only" | "landings"
      roundTripOriginDoubleCharge?: boolean
      tripCap?: number
    }
    landingFees?: {
      countingMode: "arrivals_only" | "landings"
      defaultAmount: number
      hdOverrideAmount?: number
      hdAirports?: Airport[]
      conditionalLogic?: "standard" | "homebase_conditional"
      homebase?: Airport
    }
    priceConstraints?: {
      minPricePerLeg?: number
      minTripPrice?: number
      maxTripPrice?: number
    }
    overnight?: {
      amountPerNight: number
      appliesWhen: "none" | "round_trip_only" | "always"
      maxNightsBeforeSplit?: number
    }
    daily?: {
      amountPerCalendarDay: number
      calendarDayCounting: "unique_dates_touched" | "nights_plus_one"
      dateOverrides?: Array<{
        startDate: string
        endDate: string
        amountPerDay: number
        label?: string
      }>
    }
  }
  eligibility: {
    domesticOnly: boolean
    maxAdvanceDays: number
    maxPassengers?: number
    excludeStates?: string[]
    jetInsights?: {
      icalLink?: string
    }
    geoRules?: Array<
      | {
          type: "mississippi_rule"
          oneWayRequires: "both_east" | "both_west"
          roundTripUpToNightsRequiresOrigin: number
          roundTripUpToNightsSide: "east" | "west"
          roundTripBeyondNightsRequires: "both_east" | "both_west"
        }
      | {
          type: "mississippi_ppj_round_trip"
          enabled: boolean
        }
      | {
          type: "allowed_countries"
          countries: string[]
        }
    >
  }
  results: {
    selection: "lowest" | "highest" | "all"
    rankMetric: "price" | "matchScore"
  }
}

export type QuoteRequestPayload = {
  trip: TripInput
  knobs: PricingKnobs
}
