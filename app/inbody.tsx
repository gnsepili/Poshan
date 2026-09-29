import { useEffect, useState } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useRouter } from 'expo-router'
import { useAuthStore } from '../stores/authStore'
import { useInbodyStore } from '../stores/inbodyStore'
import { InBodyPhotoCapture } from '../components/inbody/InBodyPhotoCapture'
import { analyzeInBodyPhoto, InBodyAnalysisResult } from '../lib/api/inbody'

const numOrEmpty = (v: number | null) => (v === null ? '' : String(v))
const parseOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

export default function InBodyScreen() {
  const router = useRouter()
  const { user } = useAuthStore()
  const { reports, fetchReports, addReport, loading, error } = useInbodyStore()

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
    <ScrollView className="flex-1 bg-gray-50">
      <View className="bg-white px-6 pt-14 pb-4 border-b border-gray-100 flex-row items-center">
        <Pressable onPress={() => router.back()} className="mr-3"><Text className="text-green-600 text-lg">‹ Back</Text></Pressable>
        <Text className="text-2xl font-bold text-gray-900">InBody scan</Text>
      </View>

      <View className="px-6 pt-4">
        <InBodyPhotoCapture onUploaded={onUploaded} />
        {analyzing && <ActivityIndicator className="my-4" color="#16a34a" />}
        {analyzeError && <Text className="text-red-500 mb-2">{analyzeError}</Text>}
        {error && <Text className="text-red-500 mb-2">{error}</Text>}

        {analysis && (
          <View className="mt-2">
            <Text className="text-gray-500 text-sm mb-3">Review the extracted values. Blank fields could not be read from the photo — leave them blank rather than guessing.</Text>
            {metricFields.map(({ label, value, setter }) => (
              <View key={label} className="mb-4">
                <Text className="text-gray-600 mb-1">{label}</Text>
                <TextInput className="border border-gray-300 rounded-lg px-4 py-3" keyboardType="decimal-pad" value={value} onChangeText={setter} placeholder="Not read" />
              </View>
            ))}
            <Pressable className="bg-green-600 rounded-lg py-4 items-center mb-6" onPress={handleSave} disabled={loading}>
              {loading ? <ActivityIndicator color="white" /> : <Text className="text-white font-semibold text-base">Save scan</Text>}
            </Pressable>
          </View>
        )}

        <Text className="font-semibold text-gray-700 mb-3">Past scans</Text>
        {reports.length === 0
          ? <Text className="text-gray-400 text-center py-8">No scans yet</Text>
          : reports.map((r) => (
            <View key={r.id} className="bg-white rounded-xl p-4 mb-3 border border-gray-100">
              <Text className="text-xs text-gray-400 mb-1">{new Date(r.scanned_at).toLocaleDateString()}</Text>
              <View className="flex-row flex-wrap gap-x-4">
                <Text className="text-sm text-gray-700">Wt: {r.weight_kg ?? '—'} kg</Text>
                <Text className="text-sm text-gray-700">BF: {r.body_fat_pct ?? '—'}%</Text>
                <Text className="text-sm text-gray-700">Muscle: {r.muscle_mass_kg ?? '—'} kg</Text>
              </View>
              {r.ai_notes ? <Text className="text-xs text-amber-700 mt-2 bg-amber-50 rounded p-2">{r.ai_notes}</Text> : null}
            </View>
          ))}
      </View>
    </ScrollView>
  )
}
