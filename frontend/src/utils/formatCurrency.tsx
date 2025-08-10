// src/utils/formatCurrency.tsx
export function formatCurrency(amount: number, currency?: string): string {
  const curr = currency ?? 'USD'; // fallback
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: curr,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
