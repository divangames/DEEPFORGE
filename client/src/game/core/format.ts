export function formatCompact(value: number, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) return '0';
  const abs = Math.abs(value);
  const units = [
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
  ];

  for (const unit of units) {
    if (abs >= unit.value) {
      return `${(value / unit.value).toFixed(maximumFractionDigits).replace(/\.0$/, '')}${unit.suffix}`;
    }
  }

  return Math.floor(value).toLocaleString('en-US');
}
