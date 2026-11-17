export interface RegionOption {
  id: number
  name: string
  parcels: number
}
export interface GroupOption {
  code: string
  name: string
  parcels: number
}
export interface CategoryOption {
  code: string
  name: string
  annotations: number
}
export interface Meta {
  regions: RegionOption[]
  groups: GroupOption[]
  categories: CategoryOption[]
  years: { year: number; annotations: number }[]
  imported_at: string | null
}

export interface Figures {
  parcels: number
  damaged: number
  owned_area: number | null
  total_area: number | null
  value_usd: number | null
  sankari_value_usd: number | null
  asali_value_usd: number | null
  value_syp: number | null
  valued_parcels: number
  operations: number
  operation_minutes: number
  valued_operations: number
  purchased_parcels: number
  regions: number
  annotations: number
  parcels_with_annotations: number
}

export interface RegionRow {
  id: number
  name: string
  parcels: number
  owned_area: number | null
  total_area: number | null
  value_usd: number | null
  annotations: number
}
export interface GroupRow {
  code: string
  name: string
  parcels: number
  owned_area: number | null
  total_area: number | null
  value_usd: number | null
}
export interface CategoryRow {
  code: string
  name: string
  annotations: number
}
export interface YearCategoryRow {
  year: number
  category: string
  annotations: number
}
export interface PurchaseYearRow {
  year: number
  channel: string
  purchases: number
}
export interface AcquisitionYearRow {
  year: number
  transfers: number
  judgments: number
}
export interface Overview {
  figures: Figures
  by_region: RegionRow[]
  by_group: GroupRow[]
  annotations_by_category: CategoryRow[]
  annotations_by_year: YearCategoryRow[]
  purchases_by_year: PurchaseYearRow[]
  acquisitions_by_year: AcquisitionYearRow[]
  land_status: { code: string; parcels: number; total_area: number | null }[]
  acquisition_methods: { code: string; parcels: number }[]
  timing: { code: string; annotations: number }[]
  top_placers: { name: string; category: string; annotations: number }[]
  target_party: { code: string; annotations: number }[]
  region_category: { region_id: number; category: string; annotations: number }[]
}

export interface ParcelRow {
  id: number
  minute_no: string
  is_damaged: number
  kashf16_ref: string | null
  land_status: 'full' | 'joint' | null
  minute_area: number | null
  total_area: number | null
  total_shares: number | null
  k16_value_usd: number | null
  sankari_value_usd: number | null
  asali_value_usd: number | null
  first_purchase_date: string | null
  acquisition_method: string | null
  region_id: number
  region: string
  group_code: string
  group_name: string
  annotation_count: number
  property_type: 'land' | 'apartment'
  /** Value of the whole purchase operation this minute belongs to (written once, on the operation's first minute). */
  operation_value: number | null
  operation_minutes: number
}

export interface Page<T> {
  total: number
  page: number
  per: number
  items: T[]
}

export interface AnnotationRow {
  id: number
  parcel_id: number
  ref_no: number | null
  ref_date: string | null
  ref_year: number | null
  placed_by: string | null
  category: string
  category_name: string
  placed_on: string | null
  target_party: string | null
  target_shares: number | null
  timing: string | null
  minute_no: string
  region: string
}

export interface ParcelDetail {
  parcel: {
    id: number
    region: string
    minute_no: string
    is_damaged: number
    group_name: string
    ownership_group: string
    kashf16_ref: string | null
    land_status: 'full' | 'joint' | null
    registry_status: string | null
    asali_registered_on: string | null
    asali_registered_raw: string | null
    first_purchase_date: string | null
    acquisition_method: string | null
    transfer_date: string | null
    judgment_date: string | null
    transfer_raw: string | null
    minute_area: number | null
    total_area: number | null
    total_shares: number | null
    sankari_shares: number | null
    asali_shares: number | null
    k16_area: number | null
    k16_value_syp: number | null
    k16_value_usd: number | null
    sankari_value_usd: number | null
    asali_value_usd: number | null
    notes: string | null
    source_row_start: number
    source_row_end: number
    merged_source_rows: string | null
    property_type: 'land' | 'apartment'
  }
  owners: { seq: number; owner_name: string; shares: number | null; area: number | null }[]
  purchases: { seq: number; purchase_date: string | null; date_raw: string | null; purchased_by: string | null; channel: string | null }[]
  annotations: {
    seq: number
    ref_no: number | null
    ref_date: string | null
    ref_year: number | null
    ref_date_raw: string | null
    placed_by: string | null
    category: string
    category_name: string
    category_source: 'sheet' | 'derived'
    placed_on: string | null
    target_party: string | null
    target_shares: number | null
    timing: string | null
    row_sankari_shares: number | null
    row_asali_shares: number | null
    case_parcels: number
  }[]
  region: { name: string; parcels: number; avg_annotations: number | null; more_annotated: number | null; price: number | null }
  operation: {
    ref: string
    minutes: number
    valued_minutes: number
    value_usd: number | null
    value_syp: number | null
    k16_area: number | null
    price: number | null
    minutes_list: { id: number; region: string; minute_no: string; source_row: number; carries_value: number }[]
  } | null
  /** Kashf 16 lines written under this minute that are purchase operations of their own. */
  extra_operations: { ref: string; owners: string; total_area: number | null; k16_area: number | null; value_usd: number | null; value_syp: number | null; source_row: number; source_row_end: number }[]
}

export interface ExposureTotals {
  parcels: number
  total_area: number | null
  owned_area: number | null
  value_usd: number | null
}

export interface LagBucket {
  key: string
  label: string
  count: number
}

export interface Analytics {
  cases: {
    annotation_rows: number
    cases: number
    avg_rows_per_case: number | null
    multi_parcel_cases: number
    by_category: { code: string; name: string; rows: number; cases: number }[]
    top: {
      ref_no: number
      region: string
      placed_by: string | null
      category: string
      category_name: string
      year: number | null
      parcels: number
      annotation_rows: number
      total_area: number | null
      value_usd: number | null
    }[]
  }
  exposure: {
    critical_codes: string[]
    all: ExposureTotals
    critical: ExposureTotals
    clean: ExposureTotals
    by_category: ({ code: string; name: string } & ExposureTotals)[]
    by_region: { id: number; name: string; parcels: number; critical_parcels: number; clean_parcels: number }[]
    top_parcels: {
      id: number
      region: string
      minute_no: string
      critical: number
      arbitration: number
      security: number
      state: number
      total: number
      total_area: number | null
      value_usd: number | null
    }[]
  }
  pricing: {
    operations: number
    weighted_price: number | null
    stats: { n: number; min: number | null; p25: number | null; median: number | null; p75: number | null; max: number | null; mean: number | null }
    by_region: { id: number; name: string; operations: number; price: number; median: number }[]
    unvalued: { operations: number; minutes: number; total: number }
  }
  lags: {
    purchase_to_transfer: {
      n: number
      min: number | null
      p25: number | null
      median: number | null
      p75: number | null
      max: number | null
      mean: number | null
      buckets: LagBucket[]
      by_region: { id: number; name: string; parcels: number; median: number }[]
    }
    transfer_to_annotation: { n: number; median: number | null; before: number; buckets: LagBucket[] }
  }
}

export interface QualityMetric {
  key: string
  label: string
  unit: string
  pending: boolean
  /** Which drill-down explains the gap: the missing records, or the purchase operations. */
  drill: 'missing' | 'operations'
  applies_to: string | null
  note: string | null
  applicable: number
  have: number
}

export interface QualityReport {
  parcels_total: number
  annotations_total: number
  parcels: QualityMetric[]
  annotations: QualityMetric[]
}

export interface MissingRecord {
  parcel_id: number
  region: string
  minute_no: string
  source_row: number
  source_row_end?: number
  group_name?: string
  reason?: string | null
  placed_by?: string | null
  ref_no?: number | null
  ref_year?: number | null
}

export interface MissingResult {
  kind: 'parcel' | 'annotation'
  total: number
  items: MissingRecord[]
}

export interface OperationRow {
  ref: string
  minutes: number
  valued_minutes: number
  value_usd: number | null
  value_syp: number | null
  k16_area: number | null
  total_area: number | null
  owned_area: number | null
  first_purchase_date: string | null
  purchase_year: number | null
  price: number | null
  regions: string
  owners: string
  /** Set when the operation is a Kashf 16 line written under a minute listed twice: that minute's number. */
  listed_under: string | null
}

export interface OperationsReport {
  summary: {
    operations: number
    valued_operations: number
    minutes: number
    value_usd: number
    value_syp: number
    k16_area: number
  }
  /** Minutes with no Kashf 16 number (apartments, a few problem lands). */
  loose: { minutes: number; valued_minutes: number | null; value_usd: number | null; value_syp: number | null }
  by_year: { year: number | null; operations: number; minutes: number; value_usd: number }[]
  items: OperationRow[]
}
