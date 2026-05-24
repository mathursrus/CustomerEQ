import Svg, { Polyline, Circle } from 'react-native-svg'

interface Props { data: number[]; width?: number; height?: number }

export function NpsSparkline({ data, width = 320, height = 40 }: Props) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data) - 5
  const max = Math.max(...data) + 5
  const range = max - min || 1
  const step = width / (data.length - 1)
  const points = data.map((v, i) => `${i * step},${height - ((v - min) / range) * height}`).join(' ')
  const last = data[data.length - 1]!
  const lastX = (data.length - 1) * step
  const lastY = height - ((last - min) / range) * height

  return (
    <Svg width={width} height={height} style={{ marginTop: 8 }}>
      <Polyline points={points} fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={lastX} cy={lastY} r={4} fill="#fff" />
    </Svg>
  )
}
