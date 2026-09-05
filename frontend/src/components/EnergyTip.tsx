import { ENERGY_TIPS } from '../data/energyTips'

export default function EnergyTip() {
  const dayIndex = Math.floor(Date.now() / 86_400_000) % ENERGY_TIPS.length
  const tip = ENERGY_TIPS[dayIndex]
  return <span><strong>{tip.title}:</strong> {tip.content} {tip.savings}</span>
}
