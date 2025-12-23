// Extracted from docs/knobs.txt
// This file exports the KNOB_UI_TABS schema for use in KnobPanel

export type KnobUiField =
  | {
      type: "select"
      path: string
      label: string
      why: string
      help: string
      options: { label: string; value: string }[]
      enabledWhen?: string
    }
  | {
      type: "number"
      path: string
      label: string
      why: string
      help: string
      min?: number
      max?: number
      step?: number
      enabledWhen?: string
    }
  | {
      type: "toggle"
      path: string
      label: string
      why: string
      help: string
      enabledWhen?: string
    }
  | {
      type: "airportSingle"
      path: string
      label: string
      why: string
      help: string
      enabledWhen?: string
      placeholder?: string
    }
  | {
      type: "airportMulti"
      path: string
      label: string
      why: string
      help: string
      enabledWhen?: string
    }
  | {
      type: "geoRulesEditor"
      path: "eligibility.geoRules"
      label: string
      why: string
      help: string
      enabledWhen?: string
    }

export type KnobUiTab = {
  id: string
  title: string
  sections: {
    title: string
    description?: string
    fields: KnobUiField[]
  }[]
}

export const KNOB_UI_TABS: KnobUiTab[] = [
  /* ─────────────────────────────── RATES ─────────────────────────────── */
  {
    id: "rates",
    title: "Rates",
    sections: [
      {
        title: "Base Pricing Model",
        fields: [
          {
            type: "select",
            path: "pricing.rateModel",
            label: "Rate model",
            why: "Defines how flight hours convert to base cost.",
            help:
              "Single hourly charges the same rate for repo and occupied.\n" +
              "Dual rate charges repo cheaper than passenger time.",
            options: [
              { label: "Single hourly", value: "single_hourly" },
              {
                label: "Dual rate (repo / occupied)",
                value: "dual_rate_repo_occupied",
              },
            ],
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "pricing.hourlyRate",
            label: "Hourly rate ($/hr)",
            why: "Base cost per flight hour.",
            help: "Used when rate model is single hourly.",
            min: 0,
            step: 100,
            enabledWhen:
              "tripComplete && pricing.rateModel === 'single_hourly'",
          },
          {
            type: "number",
            path: "pricing.repoRate",
            label: "Repo rate ($/hr)",
            why: "Lower rate applied to reposition hours.",
            help: "Used when rate model is dual rate.",
            min: 0,
            step: 100,
            enabledWhen:
              "tripComplete && pricing.rateModel === 'dual_rate_repo_occupied'",
          },
          {
            type: "number",
            path: "pricing.occupiedRate",
            label: "Occupied rate ($/hr)",
            why: "Higher rate applied to passenger hours.",
            help: "Used when rate model is dual rate.",
            min: 0,
            step: 100,
            enabledWhen:
              "tripComplete && pricing.rateModel === 'dual_rate_repo_occupied'",
          },
        ],
      },
    ],
  },

  /* ─────────────────────────────── REPO ─────────────────────────────── */
  {
    id: "repo",
    title: "Repositioning",
    sections: [
      {
        title: "Repo Strategy",
        description: "Control where the aircraft starts and ends.",
        fields: [
          {
            type: "select",
            path: "repo.mode",
            label: "Repo mode",
            why: "Determines how reposition legs are created.",
            help:
              "Repo mode controls where the aircraft begins/ends relative to the passenger trip.\n\n" +
              "- Fixed base: aircraft always repos to/from a single home base airport\n" +
              "- VHB network: aircraft uses the closest virtual base to the trip origin/destination",
            options: [
              { label: "Fixed base", value: "fixed_base" },
              { label: "VHB network", value: "vhb_network" },
            ],
            enabledWhen: "tripComplete",
          },
          {
            type: "select",
            path: "repo.policy",
            label: "Repo policy",
            why: "Choose which repo legs are included in billing.",
            help:
              "Repo policy controls which reposition legs are charged.\n\n" +
              "- Both: base → origin and destination → base\n" +
              "- Outbound only: base → origin only\n" +
              "- Inbound only: destination → base only",
            options: [
              { label: "Both", value: "both" },
              { label: "Outbound only", value: "outbound_only" },
              { label: "Inbound only", value: "inbound_only" },
            ],
            enabledWhen: "tripComplete",
          },
        ],
      },

      {
        title: "Fixed Base Configuration",
        description: "Used when repo mode is Fixed base.",
        fields: [
          {
            type: "airportSingle",
            path: "repo.fixedBaseIcao",
            label: "Home base airport",
            why: "Defines the fixed starting/ending airport for repo legs.",
            help:
              "When Fixed base is selected, repo legs are created relative to this airport.\n\n" +
              "Examples:\n" +
              "- Outbound repo: Home base → Trip origin\n" +
              "- Inbound repo: Trip destination → Home base",
            placeholder: "Search ICAO (e.g., KFXE, KPDK, KTEB)",
            enabledWhen: "tripComplete && repo.mode === 'fixed_base'",
          },
        ],
      },

      {
        title: "VHB Network Configuration",
        description: "Used when repo mode is VHB network.",
        fields: [
          {
            type: "airportMulti",
            path: "repo.vhbSets.default",
            label: "VHB airports",
            why: "Defines the virtual base network used for closest-base selection.",
            help:
              "The calculator chooses the closest VHB to the trip origin and destination.\n" +
              "A smaller VHB network typically increases repo time and price.",
            enabledWhen: "tripComplete && repo.mode === 'vhb_network'",
          },
          {
            type: "select",
            path: "repo.vhbSelection",
            label: "VHB selection method",
            why: "Controls how the closest base is chosen.",
            help:
              "Closest by distance uses straight-line distance (Haversine) between airports.\n" +
              "This is deterministic and easy to explain for training.",
            options: [
              { label: "Closest by distance", value: "closest_by_distance" },
            ],
            enabledWhen: "tripComplete && repo.mode === 'vhb_network'",
          },
        ],
      },

      {
        title: "Repo Limits",
        fields: [
          {
            type: "number",
            path: "repo.constraints.maxOriginRepoHours",
            label: "Max outbound repo (hrs)",
            why: "Rejects long home base → origin repositioning.",
            help: "If outbound repo exceeds this threshold, the trip may be rejected.",
            min: 0,
            step: 0.1,
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "repo.constraints.maxDestinationRepoHours",
            label: "Max inbound repo (hrs)",
            why: "Rejects long destination → home base repositioning.",
            help: "If inbound repo exceeds this threshold, the trip may be rejected.",
            min: 0,
            step: 0.1,
            enabledWhen: "tripComplete",
          },
          {
            type: "toggle",
            path: "repo.constraints.rejectIfExceeded",
            label: "Reject if repo exceeds limits",
            why: "Turns repo limits into hard constraints.",
            help: "When enabled, trips violating repo limits will return no quote.",
            enabledWhen: "tripComplete",
          },
        ],
      },
    ],
  },

  /* ─────────────────────────────── FEES ─────────────────────────────── */
  {
    id: "fees",
    title: "Fees",
    sections: [
      {
        title: "Ground & Airport Fees",
        fields: [
          {
            type: "number",
            path: "fees.groundHandling.perSegmentAmount",
            label: "Ground handling ($/segment)",
            why: "Flat fee per segment (you control which legs count).",
            help:
              "Adds a flat fee per segment.\n\n" +
              "Tip: If you set this to $100 and apply it to occupied-only segments, a one-way trip charges once.\n" +
              "If you apply it to all legs, repo legs will also count.",
            min: 0,
            step: 100,
            enabledWhen: "tripComplete",
          },
          // NEW: appliesTo for ground handling
          {
            type: "select",
            path: "fees.groundHandling.appliesTo",
            label: "Ground handling applies to",
            why: "Controls which segments are counted for ground handling fees.",
            help:
              "Choose which legs count as 'segments' for ground handling.\n\n" +
              "- Occupied only: counts passenger legs only (most common)\n" +
              "- All legs: counts passenger legs + repo legs\n\n" +
              "This is helpful when modeling fees that should also apply to reposition flying.",
            options: [
              { label: "Occupied only", value: "occupied_only" },
              { label: "All legs (occupied + repo)", value: "all_legs" },
            ],
            enabledWhen:
              "tripComplete && fees.groundHandling.perSegmentAmount > 0",
          },

          {
            type: "airportMulti",
            path: "fees.highDensity.airports",
            label: "High-density airports",
            why: "Airports that trigger congestion fees.",
            help:
              "These airports are treated as 'high density'.\n" +
              "If the trip touches them, the calculator can add a fee per visit (based on the counting mode below).",
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "fees.highDensity.feePerVisit",
            label: "HD fee per visit",
            why: "Charge per visit to a high-density airport.",
            help:
              "Sets the dollar amount charged per 'visit'.\n" +
              "What counts as a visit depends on the counting mode below.",
            min: 0,
            step: 100,
            enabledWhen: "tripComplete",
          },
          // NEW: countingMode for high density
          {
            type: "select",
            path: "fees.highDensity.countingMode",
            label: "HD counting mode",
            why: "Defines what counts as a 'visit' to a high-density airport.",
            help:
              "Controls how HD visits are counted:\n\n" +
              "- Segment endpoints (occupied only): counts BOTH from and to airports for each occupied leg.\n" +
              "  Example (one-way A→B): A counts once, B counts once.\n\n" +
              "- Arrivals only (occupied only): counts only the arrival airport (to) for each occupied leg.\n" +
              "  Example (one-way A→B): only B counts.\n\n" +
              "- Landings (all legs): counts the arrival airport (to) for every leg, including repo.\n" +
              "  Use this when you want repo landings to also trigger HD fees.",
            options: [
              {
                label: "Segment endpoints (occupied legs)",
                value: "segment_endpoints",
              },
              {
                label: "Arrivals only (occupied legs)",
                value: "arrivals_only",
              },
              { label: "Landings (all legs incl repo)", value: "landings" },
            ],
            enabledWhen:
              "tripComplete && fees.highDensity.feePerVisit > 0 && fees.highDensity.airports",
          },
          // NEW: RT origin double charge
          {
            type: "toggle",
            path: "fees.highDensity.roundTripOriginDoubleCharge",
            label: "Round-trip: double-charge origin if HD",
            why: "Some operators charge an extra HD fee because the origin is visited twice on a round trip.",
            help:
              "When enabled (ROUND_TRIP only): if the trip origin is in the HD airport list, add +1 extra visit.\n\n" +
              "This models cases where the origin airport is effectively visited twice (depart and return).",
            enabledWhen:
              "tripComplete && trip.tripType === 'ROUND_TRIP' && fees.highDensity.feePerVisit > 0",
          },
          // NEW: trip cap
          {
            type: "number",
            path: "fees.highDensity.tripCap",
            label: "HD fee trip cap ($)",
            why: "Limits HD fees to a maximum per trip.",
            help:
              "If set, the total HD fee is capped at this amount.\n" +
              "Example: feePerVisit=$1,000 and visits=3 => $3,000; cap=$2,000 => charges $2,000.",
            min: 0,
            step: 100,
            enabledWhen:
              "tripComplete && fees.highDensity.feePerVisit > 0 && fees.highDensity.airports",
          },
          {
            type: "number",
            path: "fees.overnight.amountPerNight",
            label: "Overnight fee ($/night)",
            why: "Charge for aircraft staying away overnight (typically on round trips).",
            help:
              "Adds a per-night fee when the itinerary spans one or more midnights.\n\n" +
              "Example: depart Monday, return Wednesday → 2 overnights.\n" +
              "Fee = overnights × amountPerNight.\n\n" +
              "Tip: Set appliesWhen below to control when the fee triggers.",
            min: 0,
            step: 100,
            enabledWhen: "tripComplete",
          },
          {
            type: "select",
            path: "fees.overnight.appliesWhen",
            label: "Overnight fee applies when",
            why: "Controls which trip types can trigger overnight fees.",
            help:
              "Choose when overnight fees apply:\n\n" +
              "- None: disable overnight fees\n" +
              "- Round trip only: only charge when tripType is ROUND_TRIP\n" +
              "- Always: charge whenever overnights > 0 (including multi-leg one-ways if applicable)",
            options: [
              { label: "None", value: "none" },
              { label: "Round trip only", value: "round_trip_only" },
              { label: "Always", value: "always" },
            ],
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "fees.overnight.maxNightsBeforeSplit",
            label: "Max nights before split",
            why: "Splits a long round trip into two one-ways beyond this number of nights.",
            help:
              "If a ROUND_TRIP has more than this many overnights, the engine can split it into:\n" +
              "- Outbound ONE_WAY, and\n" +
              "- Return ONE_WAY\n\n" +
              "This is useful for pricing policies where long stays should be quoted as two separate trips.\n\n" +
              "Note: This only has an effect when tripType is ROUND_TRIP and returnLocalISO is set.",
            min: 0,
            step: 1,
            enabledWhen:
              "tripComplete && fees.overnight.appliesWhen !== 'none'",
          },
          /* ───────────────────────── DAILY FEES ───────────────────────── */
          {
            type: "number",
            path: "fees.daily.amountPerCalendarDay",
            label: "Daily fee ($/calendar day)",
            why: "Charges a fixed amount for each calendar day the trip occupies the aircraft.",
            help:
              "Adds a flat fee for each chargeable calendar day.\n\n" +
              "This models daily margin, crew cost, and aircraft availability.\n\n" +
              "Example:\n" +
              "- $2,500/day × 2 days = $5,000\n\n" +
              "How many days are counted depends on the calendar-day counting rule below.",
            min: 0,
            step: 250,
            enabledWhen: "tripComplete",
          },

          {
            type: "select",
            path: "fees.daily.calendarDayCounting",
            label: "Calendar day counting method",
            why: "Defines what counts as a billable calendar day.",
            help:
              "Controls how chargeable days are counted:\n\n" +
              "- Unique dates touched: counts each calendar date the trip touches.\n" +
              "  Example: depart Jan 10 @ 22:00, return Jan 11 @ 06:00 → 2 days\n\n" +
              "- Nights + one: counts overnights away from base plus one flying day.\n" +
              "  Example: same trip → 1 day\n\n" +
              "Operators choose this based on how they think about crew cost and aircraft availability.",
            options: [
              {
                label: "Unique calendar dates touched",
                value: "unique_dates_touched",
              },
              {
                label: "Overnights + one day",
                value: "nights_plus_one",
              },
            ],
            enabledWhen: "tripComplete && fees.daily.amountPerCalendarDay > 0",
          },
        ],
      },
      {
        title: "Landing Fees",
        description:
          "Per-landing charges; you control whether repo legs count.",
        fields: [
          {
            type: "select",
            path: "fees.landing.countingMode",
            label: "Landing fee counting mode",
            why: "Defines which landings are charged.",
            help:
              "Controls how landings are counted for landing fees:\n\n" +
              "- Arrivals only (occupied legs): charge only for passenger-leg arrivals.\n" +
              "- Landings (all legs incl repo): charge for every leg arrival, including repo legs.\n\n" +
              "Tip: If you want repo landings to show up in the ledger, choose the all-legs option.",
            options: [
              {
                label: "Arrivals only (occupied legs)",
                value: "arrivals_only",
              },
              {
                label: "Landings (all legs incl repo)",
                value: "landings",
              },
            ],
            enabledWhen: "tripComplete && fees.landing.defaultAmount > 0",
          },
          {
            type: "number",
            path: "fees.landing.defaultAmount",
            label: "Landing fee ($/landing)",
            why: "Dollar amount charged per counted landing.",
            help:
              "Flat fee charged per landing based on the counting mode.\n\n" +
              "Set to 0 to effectively disable landing fees.",
            min: 0,
            step: 50,
            enabledWhen: "tripComplete",
          },
        ],
      },
    ],
  },

  /* ─────────────────────────────── DISCOUNTS ─────────────────────────────── */
  {
    id: "discounts",
    title: "Discounts & Scoring",
    sections: [
      {
        title: "VHB Discount",
        fields: [
          {
            type: "select",
            path: "discounts.vhbDiscount.mode",
            label: "VHB discount rule",
            why: "Discounts trips near home bases.",
            help:
              "Encourages demand near operational bases.\n" +
              "Rules define whether one or both ends must be VHBs.",
            options: [
              { label: "None", value: "none" },
              {
                label: "Origin or destination",
                value: "origin_or_destination",
              },
              { label: "Both required", value: "both_required" },
            ],
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "discounts.vhbDiscount.percent",
            label: "Discount percent",
            why: "Percentage reduction applied when eligible.",
            help: "Stored as decimal (0.10 = 10%).",
            min: 0,
            max: 0.5,
            step: 0.01,
            enabledWhen:
              "tripComplete && discounts.vhbDiscount.mode !== 'none'",
          },
        ],
      },
      {
        title: "Match Score",
        fields: [
          {
            type: "toggle",
            path: "scoring.matchScore.enabled",
            label: "Enable match score",
            why: "Filters inefficient trips.",
            help:
              "Match score compares occupied vs repo time.\n" +
              "occupied / (occupied + repo) × 10",
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "scoring.matchScore.threshold",
            label: "Match score threshold",
            why: "Rejects or flags inefficient trips.",
            help: "Trips below this score are rejected or ranked lower.",
            min: 0,
            max: 10,
            step: 0.1,
            enabledWhen: "tripComplete && scoring.matchScore.enabled",
          },
        ],
      },
    ],
  },

  /* ─────────────────────────────── TIME ─────────────────────────────── */
  {
    id: "time",
    title: "Time",
    sections: [
      {
        title: "Time Adjustments",
        fields: [
          {
            type: "number",
            path: "time.taxiHoursPerLeg",
            label: "Taxi time per leg (hrs)",
            why: "Adds ground and taxi time to each leg.",
            help:
              "Taxi time is added to flight time when calculating billable hours.\n" +
              "Example: 0.2 = 12 minutes.",
            min: 0,
            max: 1,
            step: 0.05,
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "time.bufferHoursPerLeg",
            label: "Buffer time per leg (hrs)",
            why: "Adds operational padding per leg.",
            help:
              "Buffer time is commonly used to cover prep, delays, and ops padding.\n" +
              "This is one of the strongest pricing levers.",
            min: 0,
            max: 3,
            step: 0.1,
            enabledWhen: "tripComplete",
          },
          {
            type: "select",
            path: "time.applyTo",
            label: "Apply adjustments to",
            why: "Choose which legs receive taxi/buffer time.",
            help: "You can apply adjustments to occupied legs, repo legs, or both.",
            options: [
              { label: "Occupied only", value: "occupied" },
              { label: "Repo only", value: "repo" },
              { label: "Both", value: "both" },
            ],
            enabledWhen: "tripComplete",
          },
        ],
      },
      {
        title: "Minimum Time Rules",
        fields: [
          {
            type: "number",
            path: "time.minimums.minActualFlightHoursPerLeg",
            label: "Min flight time per leg (hrs)",
            why: "Rejects short inefficient legs.",
            help:
              "Measured on actual flight time (before taxi/buffer).\n" +
              "Commonly used to reject sub-2hr legs.",
            min: 0,
            step: 0.1,
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "time.minimums.minFirstOccupiedLegHours",
            label: "Min first occupied leg (hrs)",
            why: "Ensures the first passenger leg is worthwhile.",
            help: "If the first passenger leg is too short, the trip can be rejected.",
            min: 0,
            step: 0.1,
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "time.minimums.minTotalTripHours",
            label: "Min total trip hours (hrs)",
            why: "Rejects trips that are too small overall (occupied + repo).",
            help:
              "Minimum total flight time for the entire itinerary.\n\n" +
              "Measured on actual flight time (before taxi/buffer adjustments).\n" +
              "Total = sum(actual flight hours across all legs).\n\n" +
              "Useful for avoiding inefficient short trips.",
            min: 0,
            step: 0.1,
            enabledWhen: "tripComplete",
          },

          // NEW: minOccupiedHoursTotal
          {
            type: "number",
            path: "time.minimums.minOccupiedHoursTotal",
            label: "Min total occupied hours (hrs)",
            why: "Rejects trips where passenger flying is too short overall.",
            help:
              "Minimum total OCCUPIED (passenger) flight time across the trip.\n\n" +
              "Measured on actual flight time for occupied legs only (before taxi/buffer).\n" +
              "Useful when you want to ensure enough revenue passenger time even if repo is large.",
            min: 0,
            step: 0.1,
            enabledWhen: "tripComplete",
          },
        ],
      },
      {
        title: "Daily Flight Limits",
        description: "Caps on passenger flying per calendar day.",
        fields: [
          {
            type: "number",
            path: "time.dailyLimits.maxOccupiedHoursPerDay",
            label: "Max occupied hours per day (hrs)",
            why: "Rejects itineraries that exceed allowed passenger hours in a single day.",
            help:
              "Maximum OCCUPIED flight hours allowed per calendar day.\n\n" +
              "Measured on occupied legs only.\n" +
              "Useful for operator duty-day style limits or product rules for long single-day flying.",
            min: 0,
            step: 0.25,
            enabledWhen: "tripComplete",
          },
        ],
      },
    ],
  },

  /* ─────────────────────────────── ELIGIBILITY ─────────────────────────────── */
  {
    id: "eligibility",
    title: "Eligibility",
    sections: [
      {
        title: "Trip Constraints",
        fields: [
          {
            type: "toggle",
            path: "eligibility.domesticOnly",
            label: "Domestic only",
            why: "Rejects trips outside allowed geography.",
            help: "When enabled, international trips are rejected.",
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "eligibility.maxAdvanceDays",
            label: "Max advance booking (days)",
            why: "Limits how far in advance trips can be booked.",
            help: "Trips booked beyond this window are rejected.",
            min: 0,
            step: 1,
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "eligibility.maxPassengers",
            label: "Max passengers",
            why: "Rejects quotes when passenger count exceeds the operator limit.",
            help:
              "If the requested passenger count is higher than this value, the quote is rejected.\n\n" +
              "Leave blank to disable passenger limit enforcement.",
            min: 1,
            step: 1,
            enabledWhen: "tripComplete",
          },
        ],
      },
      {
        title: "Geographic Rules",
        description: "Rules that restrict quotes based on geography.",
        fields: [
          {
            type: "geoRulesEditor",
            path: "eligibility.geoRules",
            label: "Geographic rules",
            why: "Encodes operator coverage constraints like the Mississippi rule.",
            help:
              "Adds geographic eligibility rules.\n\n" +
              "Supported rules:\n" +
              "- Mississippi rule: requires airports to be on a specific side (east/west) depending on trip type and length.\n\n" +
              "If any geo rule fails, the quote is rejected.",
            enabledWhen: "tripComplete",
          },
        ],
      },
    ],
  },
]
