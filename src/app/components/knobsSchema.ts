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
            why: "Flat fee per flight segment.",
            help: "Applied per occupied segment unless configured otherwise.",
            min: 0,
            step: 100,
            enabledWhen: "tripComplete",
          },
          {
            type: "airportMulti",
            path: "fees.highDensity.airports",
            label: "High-density airports",
            why: "Airports that trigger congestion fees.",
            help: "Visiting these airports adds an extra fee per rules below.",
            enabledWhen: "tripComplete",
          },
          {
            type: "number",
            path: "fees.highDensity.feePerVisit",
            label: "HD fee per visit",
            why: "Charge per visit to a high-density airport.",
            help: "Counting method is defined separately.",
            min: 0,
            step: 100,
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
        ],
      },
    ],
  },
]
