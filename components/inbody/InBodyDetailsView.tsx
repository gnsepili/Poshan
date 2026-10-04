import { ReactNode } from 'react'
import { View } from 'react-native'
import { InBodyDetails, InBodySegment } from '../../types'
import { limbBalance, rangeStatus, waterBalanceStatus, PairBalance, WaterBalance } from '../../lib/utils/inbodyInsights'
import { Badge, Heading, Text } from '../ui'

const SEGMENTS: { key: InBodySegment; label: string }[] = [
  { key: 'right_arm', label: 'Right arm' },
  { key: 'left_arm', label: 'Left arm' },
  { key: 'trunk', label: 'Trunk' },
  { key: 'right_leg', label: 'Right leg' },
  { key: 'left_leg', label: 'Left leg' },
]

const fmt = (v: number | null, unit = '', digits = 1): string =>
  v === null ? '—' : `${Number.isInteger(v) ? v : v.toFixed(digits)}${unit ? ` ${unit}` : ''}`

const STATUS_TONE = { under: 'warning', normal: 'success', over: 'danger' } as const
const STATUS_LABEL = { under: 'Below range', normal: 'Normal', over: 'Above range' } as const

const WATER_TONE: Record<WaterBalance, 'warning' | 'success' | 'danger'> = {
  low: 'warning',
  normal: 'success',
  slightly_high: 'warning',
  high: 'danger',
}
const WATER_LABEL: Record<WaterBalance, string> = {
  low: 'Low',
  normal: 'Balanced',
  slightly_high: 'Slightly high',
  high: 'High',
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mt-5">
      <Heading level={4} uppercase className="mb-2">
        {title}
      </Heading>
      {children}
    </View>
  )
}

function Row({ label, value, badge }: { label: string; value: string; badge?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between py-1.5 border-b border-border">
      <Text variant="bodySm" muted className="flex-1 pr-3">
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        {badge}
        <Text variant="bodySm" className="font-semibold">
          {value}
        </Text>
      </View>
    </View>
  )
}

function balanceNote(pair: PairBalance | null, limb: string): string | null {
  if (!pair) return null
  if (!pair.imbalanced) return `${limb} are balanced (${pair.diffPct}% apart).`
  return `Your ${pair.stronger} ${limb.toLowerCase().replace(/s$/, '')} carries ${pair.diffPct}% more lean mass — add unilateral work for the weaker side.`
}

// Full read-out of an extraction_version 2 InBody sheet.
export function InBodyDetailsView({ details }: { details: InBodyDetails }) {
  const { core, body_composition: comp, research, weight_control: control, reference_ranges: ranges } = details
  const statusBadge = (value: number | null, metric: string) => {
    const status = rangeStatus(value, metric, ranges)
    return status ? <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} /> : undefined
  }
  const balance = limbBalance(details.segmental_lean)
  const water = waterBalanceStatus(details.ecw_tbw_ratio)
  const notes = [balanceNote(balance.arms, 'Arms'), balanceNote(balance.legs, 'Legs')].filter(Boolean) as string[]

  return (
    <View>
      <Section title="Muscle & fat">
        <Row label="Weight" value={fmt(core.weight_kg, 'kg')} badge={statusBadge(core.weight_kg, 'weight_kg')} />
        <Row
          label="Skeletal muscle mass"
          value={fmt(core.skeletal_muscle_mass_kg, 'kg')}
          badge={statusBadge(core.skeletal_muscle_mass_kg, 'skeletal_muscle_mass_kg')}
        />
        <Row label="Body fat mass" value={fmt(core.body_fat_mass_kg, 'kg')} badge={statusBadge(core.body_fat_mass_kg, 'body_fat_mass_kg')} />
        <Row label="Body fat" value={fmt(core.percent_body_fat, '%')} badge={statusBadge(core.percent_body_fat, 'percent_body_fat')} />
        <Row label="BMI" value={fmt(core.bmi)} badge={statusBadge(core.bmi, 'bmi')} />
        <Row label="Visceral fat level" value={fmt(core.visceral_fat_level)} />
        <Row label="BMR" value={fmt(core.bmr_kcal, 'kcal', 0)} />
      </Section>

      <Section title="Body composition">
        <Row
          label="Total body water"
          value={fmt(comp.total_body_water_l, 'L')}
          badge={statusBadge(comp.total_body_water_l, 'total_body_water_l')}
        />
        <Row label="Intracellular water" value={fmt(comp.intracellular_water_l, 'L')} />
        <Row label="Extracellular water" value={fmt(comp.extracellular_water_l, 'L')} />
        <Row label="Protein" value={fmt(comp.protein_kg, 'kg')} badge={statusBadge(comp.protein_kg, 'protein_kg')} />
        <Row label="Minerals" value={fmt(comp.minerals_kg, 'kg')} badge={statusBadge(comp.minerals_kg, 'minerals_kg')} />
        <Row label="Bone mineral content" value={fmt(comp.bone_mineral_content_kg, 'kg')} />
        <Row label="Fat-free mass" value={fmt(comp.fat_free_mass_kg, 'kg')} />
        <Row label="Soft lean mass" value={fmt(comp.soft_lean_mass_kg, 'kg')} />
      </Section>

      <Section title="Segmental lean & fat">
        <View className="flex-row py-1.5 border-b border-border">
          <Text variant="caption" muted className="flex-1">Segment</Text>
          <Text variant="caption" muted className="w-28 text-right">Lean</Text>
          <Text variant="caption" muted className="w-28 text-right">Fat</Text>
        </View>
        {SEGMENTS.map(({ key, label }) => {
          const lean = details.segmental_lean[key]
          const fat = details.segmental_fat[key]
          return (
            <View key={key} className="flex-row py-1.5 border-b border-border">
              <Text variant="bodySm" muted className="flex-1">{label}</Text>
              <Text variant="bodySm" className="w-28 text-right font-semibold">
                {fmt(lean.kg, 'kg')}{lean.pct !== null ? ` · ${fmt(lean.pct, '%', 0)}` : ''}
              </Text>
              <Text variant="bodySm" className="w-28 text-right font-semibold">
                {fmt(fat.kg, 'kg')}{fat.pct !== null ? ` · ${fmt(fat.pct, '%', 0)}` : ''}
              </Text>
            </View>
          )
        })}
        {notes.map((n) => (
          <Text key={n} variant="caption" muted className="mt-2">
            {n}
          </Text>
        ))}
      </Section>

      <Section title="Water balance">
        <Row
          label="ECW / TBW ratio"
          value={fmt(details.ecw_tbw_ratio, '', 3)}
          badge={water ? <Badge label={WATER_LABEL[water]} tone={WATER_TONE[water]} /> : undefined}
        />
        {water && water !== 'normal' ? (
          <Text variant="caption" muted className="mt-2">
            {water === 'low'
              ? 'Below the 0.360–0.390 range — usually fine, but worth tracking.'
              : 'Above the 0.360–0.390 range, which can mean fluid retention or inflammation. Re-check after rest and good hydration; mention it to a doctor if it stays high.'}
          </Text>
        ) : null}
      </Section>

      <Section title="More measures">
        <Row label="Waist-hip ratio" value={fmt(research.waist_hip_ratio, '', 2)} badge={statusBadge(research.waist_hip_ratio, 'waist_hip_ratio')} />
        <Row label="Waist circumference" value={fmt(research.waist_circumference_cm, 'cm')} />
        <Row label="Obesity degree" value={fmt(research.obesity_degree_pct, '%', 0)} />
        <Row label="Skeletal muscle index" value={fmt(research.smi_kg_m2, 'kg/m²')} />
        <Row label="Phase angle" value={fmt(research.phase_angle_deg, '°')} />
        <Row label="Body cell mass" value={fmt(research.body_cell_mass_kg, 'kg')} />
        <Row label="Recommended intake" value={fmt(research.recommended_calorie_intake_kcal, 'kcal', 0)} />
      </Section>

      <Section title="Weight control">
        <Row label="Target weight" value={fmt(control.target_weight_kg, 'kg')} />
        <Row label="Weight control" value={fmt(control.weight_control_kg, 'kg')} />
        <Row label="Fat control" value={fmt(control.fat_control_kg, 'kg')} />
        <Row label="Muscle control" value={fmt(control.muscle_control_kg, 'kg')} />
      </Section>

      {details.other_values.length > 0 ? (
        <Section title="Also on the sheet">
          {details.other_values.map((o, i) => (
            <Row key={`${o.label}-${i}`} label={o.label} value={o.value} />
          ))}
        </Section>
      ) : null}
    </View>
  )
}
