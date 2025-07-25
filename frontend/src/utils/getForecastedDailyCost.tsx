import { Appliance } from '../context/AppContext'
import { generateEstimate } from './energyEstimator'

export function getForecastedDailyCost({
  appliances,
  convertCost,
  getApplianceTypeInfo,
}: {
  appliances: Appliance[]
  convertCost: (kwh: number) => number
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number }
}): number {
  const points = generateEstimate({
    appliances,
    convertCost,
    count: 30,
    daysPer: 1,
    disableNoise: false,
    getApplianceTypeInfo: (type) => getApplianceTypeInfo?.(type) ?? {},
  })

  const total = points.reduce((sum, p) => sum + (p.total ?? 0), 0)
  return total / 30
}
