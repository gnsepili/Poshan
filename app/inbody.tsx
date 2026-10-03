import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '../stores/authStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { InBodyPhotoCapture } from '../components/inbody/InBodyPhotoCapture'
import { analyzeInBodyPhoto, InBodyAnalysisResult } from '../lib/api/inbody'
import { Screen, Card, Input, Button, Heading, Text, EmptyState } from '../components/ui'
import { useThemeColors } from '../lib/theme'
import { Scale, Sparkles } from 'lucide-react-native'

const numOrEmpty = (v: number | null) => (v === null ? '' : String(v))
const parseOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

export default function InBodyScreen() {
  const { user } = useAuthStore()
  const { reports, fetchReports, addReport, loading, error } = useInbodyStore()
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

  useEffect(() => { if (user) fetchReports(user.id) }, [user])

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
    if (!user || !path) return
    const parsedBmr = parseOrNull(bmr)
    const result = await addReport({
      user_id: user.id,
      photo_url: path,
      weight_kg: parseOrNull(weight),
      body_fat_pct: parseOrNull(bodyFat),
      muscle_mass_kg: parseOrNull(muscle),
      visceral_fat: parseOrNull(visceral),
      bmr: parsedBmr === null ? null : Math.round(parsedBmr),
      raw_extracted_json: analysis?.raw ?? null,
      ai_notes: analysis?.notes ?? null,
    })
    if (result) {
      setPath(null); setAnalysis(null)
      setWeight(''); setBodyFat(''); setMuscle(''); setVisceral(''); setBmr('')
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
    <Screen back title="InBody scan" scroll>
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
          <Text variant="bodySm" muted className="mb-4">
            Review the extracted values. Blank fields could not be read from the photo — leave
            them blank rather than guessing.
          </Text>
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
          {reports.map((r) => (
            <Card key={r.id}>
              <Text variant="caption" muted className="mb-2">
                {new Date(r.scanned_at).toLocaleDateString()}
              </Text>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                <Text variant="bodySm">Wt: {r.weight_kg ?? '—'} kg</Text>
                <Text variant="bodySm">BF: {r.body_fat_pct ?? '—'}%</Text>
                <Text variant="bodySm">Muscle: {r.muscle_mass_kg ?? '—'} kg</Text>
              </View>
              {r.ai_notes ? (
                <View className="flex-row items-start gap-2 mt-3 bg-accent-soft rounded-xl p-3">
                  <Sparkles size={15} color={colors.accent} />
                  <Text variant="caption" className="flex-1 text-foreground">{r.ai_notes}</Text>
                </View>
              ) : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  )
}
