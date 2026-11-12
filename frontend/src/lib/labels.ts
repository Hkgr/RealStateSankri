// Arabic labels and one colour per concept, shared by every chart, pill and table.
export const CATEGORY_COLORS: Record<string, string> = {
  arbitration: '#4f46e5',
  security: '#be123c',
  liquidation: '#d97706',
  state: '#0284c7',
  cancellation: '#9333ea',
  private_claim: '#64748b',
}

export const GROUP_COLORS: Record<string, string> = {
  sankari_100: '#0f766e',
  joint_75_25: '#65a30d',
  asali_100: '#c2410c',
  problem: '#a16207',
  unclassified: '#94a3b8',
}

export const LAND_STATUS_LABELS: Record<string, string> = {
  full: 'اميري / التمام',
  joint: 'اميري / الشيوع',
  apartment: 'شقق سكنية (حالة خاصة)',
  unknown: 'غير محدد حاليًا',
}
export const LAND_STATUS_COLORS: Record<string, string> = { full: '#0f766e', joint: '#65a30d', apartment: '#0284c7', unknown: '#94a3b8' }

export const ACQUISITION_LABELS: Record<string, string> = {
  transfer: 'فراغة',
  judgment: 'حكم',
  judgment_then_transfer: 'حكم ثم فراغة',
  none: 'غير مسجّل',
}
export const ACQUISITION_COLORS: Record<string, string> = {
  transfer: '#0f766e',
  judgment: '#c2410c',
  judgment_then_transfer: '#4f46e5',
  none: '#94a3b8',
}

export const CHANNEL_LABELS: Record<string, string> = {
  broker: 'دلال',
  agent: 'وكيل / بالنيابة',
  principal: 'الأصيل نفسه',
  accounting: 'تاريخ من المحاسبة (بلا عقد)',
  other: 'أخرى',
  unknown: 'غير محدد',
}
export const CHANNEL_COLORS: Record<string, string> = {
  broker: '#0f766e',
  agent: '#4f46e5',
  principal: '#d97706',
  accounting: '#0284c7',
  other: '#9333ea',
  unknown: '#94a3b8',
}

export const TIMING_LABELS: Record<string, string> = {
  before_purchase: 'قبل الشراء',
  before_transfer: 'قبل الفراغة',
  after_transfer: 'بعد الفراغة',
  before_judgment: 'قبل الحكم',
  after_judgment: 'بعد الحكم',
  unknown: 'غير محدد',
}

export const TARGET_LABELS: Record<string, string> = {
  sankari: 'على حصة د. سنكري',
  asali: 'على حصة عسلي',
  both: 'على الحصتين معًا',
  other: 'على طرف آخر',
  unknown: 'غير محدد',
}
export const TARGET_COLORS: Record<string, string> = {
  sankari: '#0f766e',
  asali: '#c2410c',
  both: '#4f46e5',
  other: '#64748b',
  unknown: '#cbd5e1',
}
