import { useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../stores/authStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { InBodyPhotoCapture } from '../components/inbody/InBodyPhotoCapture'
import { InBodyDetailsView } from '../components/inbody/InBodyDetailsView'
import { analyzeInBodyPhoto, InBodyAnalysisResult } from '../lib/api/inbody'
import { reportColumnsFromAnalysis } from '../lib/utils/inbodyReport'
import { countReadValues, isFullExtraction } from '../lib/utils/inbodyInsights'
import { InBodyDetails, InBodyReport } from '../types'
import { Screen, Card, Input, Button, Heading, Text, EmptyState, Badge } from '../components/ui'
import { useThemeColors } from '../lib/theme'
import { useAutoRefresh } from '../lib/hooks/useAutoRefresh'
import { Scale, Sparkles } from 'lucide-react-native'

const numOrEmpty = (v: number | null) => (v === null ? '' : String(v))
const parseOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

export default function InBodyScreen() {
  const { user } = useAuthStore()
  const { reports, fetchReports, addReport, updateReport, loading, error } = useInbodyStore()
  const colors = useThemeColors()

  const [path, setPath] = useState<string | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<InBodyAnalysisResult | null>(null)
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [muscle, setMuscle] = useState('')
  const [visceral, setVisceral] = useState('')
  const [bmr, setBmr] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rereadingId, setRereadingId] = useState<string | null>(null)
  const [rereadError, setRereadError] = useState<{ id: string; message: string } | null>(null)

  const { refreshing, onRefresh } = useAutoRefresh(() => (user ? fetchReports(user.id) : undefined), { enabled: !!user })

  const onUploaded = async (uploadedPath: string) => {
    setPath(uploadedPath)
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const result = await analyzeInBodyPhoto(uploadedPath)
      setAnalysis(result)
      setWeight(numOrEmpty(result.weight_kg))
      setBodyFat(numOrEmpty(result.body_fat_pct))
      setMuscle(numOrEmpty(result.muscle_mass_kg))
      setVisceral(numOrEmpty(result.visceral_fat))
      setBmr(numOrEmpty(result.bmr))
    } catch (e) {
      setAnalyzeError((e as Error).message)
    } finally {
      setAnalyzing(false)
    }
  }

  const handleSave = async () => {
    if (!user || !path || !analysis) return
    const parsedBmr = parseOrNull(bmr)
    const headline = {
      weight_kg: parseOrNull(weight),
      body_fat_pct: parseOrNull(bodyFat),
      muscle_mass_kg: parseOrNull(muscle),
      visceral_fat: parseOrNull(visceral),
      bmr: parsedBmr === null ? null : Math.round(parsedBmr),
    }
    const result = await addReport({ user_id: user.id, photo_url: path, ...reportColumnsFromAnalysis(analysis, headline) })
    if (result) {
      setPath(null); setAnalysis(null)
      setWeight(''); setBodyFat(''); setMuscle(''); setVisceral(''); setBmr('')
      setExpandedId(result.id)
    }
  }

  // Older scans were saved with only five values: re-read the stored photo in full.
  const rereadReport = async (report: InBodyReport) => {
    if (!report.photo_url) return
    setRereadingId(report.id)
    setRereadError(null)
    try {
      const result = await analyzeInBodyPhoto(report.photo_url)
      const updated = await updateReport(
        report.id,
        reportColumnsFromAnalysis(result, {
          weight_kg: result.weight_kg ?? report.weight_kg,
          body_fat_pct: result.body_fat_pct ?? report.body_fat_pct,
          muscle_mass_kg: result.muscle_mass_kg ?? report.muscle_mass_kg,
          visceral_fat: result.visceral_fat ?? report.visceral_fat,
          bmr: result.bmr ?? report.bmr,
        })
      )
      if (updated) setExpandedId(updated.id)
    } catch (e) {
      setRereadError({ id: report.id, message: (e as Error).message })
    } finally {
      setRereadingId(null)
    }
  }

  const metricFields: { label: string; value: string; setter: (v: string) => void }[] = [
    { label: 'Weight (kg)', value: weight, setter: setWeight },
    { label: 'Body fat (%)', value: bodyFat, setter: setBodyFat },
    { label: 'Muscle mass (kg)', value: muscle, setter: setMuscle },
    { label: 'Visceral fat', value: visceral, setter: setVisceral },
    { label: 'BMR (kcal)', value: bmr, setter: setBmr },
  ]

  return (
    <Screen back title="InBody scan" scroll refreshing={refreshing} onRefresh={onRefresh}>
      {error ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{error}</Text>
        </View>
      ) : null}

      <InBodyPhotoCapture onUploaded={onUploaded} />

      {analyzing ? (
        <View className="flex-row items-center gap-2 my-4">
          <ActivityIndicator color={colors.primary} />
          <Text variant="bodySm" muted>Reading your scan…</Text>
        </View>
      ) : null}

      {analyzeError ? (
        <View className="bg-danger-soft rounded-2xl px-4 py-3 mb-4">
          <Text variant="bodySm" className="text-danger">{analyzeError}</Text>
        </View>
      ) : null}

      {analysis ? (
        <Card className="mb-6">
          <Text variant="bodySm" muted className="mb-2">
            Review the key values. Blank fields could not be read from the photo — leave them
            blank rather than guessing.
          </Text>
          <View className="mb-4">
            <Badge label={`${countReadValues(analysis.details)} values read from your sheet`} tone="primary" />
          </View>
          <View className="gap-4 mb-4">
            {metricFields.map(({ label, value, setter }) => (
              <Input
                key={label}
                label={label}
                keyboardType="decimal-pad"
                value={value}
                onChangeText={setter}
                placeholder="Not read"
              />
            ))}
          </View>
          <Button label="Save scan" onPress={handleSave} loading={loading} />
        </Card>
      ) : null}

      <Heading level={4} uppercase className="mb-3">Past scans</Heading>
      {reports.length === 0 ? (
        <EmptyState
          icon={Scale}
          title="No scans yet"
          description="Capture an InBody printout to start tracking your body composition over time."
        />
      ) : (
        <View className="gap-3">
          {reports.map((r) => {
            const full = isFullExtraction(r)
            const expanded = expandedId === r.id
            return (
              <Card key={r.id}>
                <View className="flex-row items-center justify-between mb-2">
                  <Text variant="caption" muted>
                    {new Date(r.scanned_at).toLocaleDateString()}
                  </Text>
                  {r.inbody_score !== null ? <Badge label={`Score ${r.inbody_score}`} tone="primary" /> : null}
                </View>
                <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                  <Text variant="bodySm">Wt: {r.weight_kg ?? '—'} kg</Text>
                  <Text variant="bodySm">BF: {r.body_fat_pct ?? '—'}%</Text>
                  <Text variant="bodySm">Muscle: {r.muscle_mass_kg ?? '—'} kg</Text>
                  {r.visceral_fat !== null ? <Text variant="bodySm">Visceral: {r.visceral_fat}</Text> : null}
                </View>
                {r.ai_notes ? (
                  <View className="flex-row items-start gap-2 mt-3 bg-accent-soft rounded-xl p-3">
                    <Sparkles size={15} color={colors.accent} />
                    <Text variant="caption" className="flex-1 text-foreground">{r.ai_notes}</Text>
                  </View>
                ) : null}

                {full ? (
                  <>
                    <Button
                      label={expanded ? 'Hide full report' : 'View full report'}
                      variant="ghost"
                      size="sm"
                      className="mt-2 self-start"
                      onPress={() => setExpandedId(expanded ? null : r.id)}
                    />
                    {expanded ? <InBodyDetailsView details={r.raw_extracted_json as InBodyDetails} /> : null}
                  </>
                ) : r.photo_url ? (
                  <Button
                    label="Read full report"
                    variant="secondary"
                    size="sm"
                    className="mt-3"
                    loading={rereadingId === r.id}
                    disabled={rereadingId !== null}
                    onPress={() => rereadReport(r)}
                  />
                ) : null}
                {rereadError?.id === r.id ? (
                  <Text variant="caption" className="text-danger mt-2">{rereadError.message}</Text>
                ) : null}
              </Card>
            )
          })}
        </View>
      )}
    </Screen>
  )
}
