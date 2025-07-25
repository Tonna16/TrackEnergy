// src/utils/formatCurrency.tsx

export function formatCurrency(amount: number, currency: 'USD' | 'EUR'): string {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }
  