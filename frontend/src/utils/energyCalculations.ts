import domain from '../../../shared/energy-domain.json';

export type Currency = 'USD' | 'EUR';

export interface EnergyApplianceInput {
  wattage: number;
  hoursPerDay: number;
  daysPerWeek: number;
  estimatedDailyKWh?: number | null;
  active?: boolean;
  deleted?: boolean;
}

export const DEFAULT_CURRENCY = domain.defaults.currency as Currency;
export const DEFAULT_ELECTRICITY_RATE = domain.defaults.electricityRate;
export const CARBON_KG_PER_KWH = domain.carbon.kgCo2PerKwh;
export const CARBON_SOURCE = domain.carbon;

const finiteNonNegative = (value: number | null | undefined): number =>
  Number.isFinite(value) && Number(value) >= 0 ? Number(value) : 0;

export const isIncludedInTotals = (appliance: EnergyApplianceInput): boolean =>
  appliance.active !== false && appliance.deleted !== true;

export const getKwhPerDay = (appliance: EnergyApplianceInput): number => {
  if (appliance.estimatedDailyKWh !== null && appliance.estimatedDailyKWh !== undefined) {
    return finiteNonNegative(appliance.estimatedDailyKWh);
  }

  const wattage = finiteNonNegative(appliance.wattage);
  const hoursPerDay = finiteNonNegative(appliance.hoursPerDay);
  const daysPerWeek = Math.min(7, finiteNonNegative(appliance.daysPerWeek));
  return (wattage * hoursPerDay * (daysPerWeek / 7)) / 1000;
};

export const getKwhPerWeek = (appliance: EnergyApplianceInput): number =>
  getKwhPerDay(appliance) * 7;

export const daysInMonth = (year: number, monthIndex: number): number =>
  new Date(year, monthIndex + 1, 0).getDate();

export const getKwhForMonth = (
  appliance: EnergyApplianceInput,
  year: number,
  monthIndex: number,
): number => getKwhPerDay(appliance) * daysInMonth(year, monthIndex);

export const getKwhPerMonth = (appliance: EnergyApplianceInput, date = new Date()): number =>
  getKwhForMonth(appliance, date.getFullYear(), date.getMonth());

export const daysInYear = (year: number): number =>
  new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;

export const getKwhPerYear = (appliance: EnergyApplianceInput, year: number): number =>
  getKwhPerDay(appliance) * daysInYear(year);

export const totalDailyKwh = (appliances: EnergyApplianceInput[]): number =>
  appliances.filter(isIncludedInTotals).reduce((sum, appliance) => sum + getKwhPerDay(appliance), 0);

export const totalKwhForMonth = (
  appliances: EnergyApplianceInput[],
  year: number,
  monthIndex: number,
): number => totalDailyKwh(appliances) * daysInMonth(year, monthIndex);

export const calculateCost = (kwh: number, electricityRate: number): number =>
  finiteNonNegative(kwh) * finiteNonNegative(electricityRate);

export const calculateCarbonKg = (kwh: number): number =>
  finiteNonNegative(kwh) * CARBON_KG_PER_KWH;

export const formatCurrency = (amount: number, currency: Currency): string =>
  new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
