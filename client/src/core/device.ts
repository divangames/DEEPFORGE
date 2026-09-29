export type QualityTier = 'LOW' | 'MEDIUM' | 'HIGH';

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number;
}

/**
 * Предварительный выбор качества. На позднем этапе будет заменён/дополнен
 * коротким benchmark, но уже сейчас слабые устройства не получают HIGH вслепую.
 */
export function detectQualityTier(): QualityTier {
  const memory = (navigator as NavigatorWithMemory).deviceMemory ?? 4;
  const cores = navigator.hardwareConcurrency ?? 4;

  if (memory <= 2 || cores <= 2) return 'LOW';
  if (memory <= 4 || cores <= 4) return 'MEDIUM';
  return 'HIGH';
}

export function getViewportKind(width = window.innerWidth) {
  if (width < 768) return 'mobile' as const;
  if (width < 1180) return 'tablet' as const;
  return 'desktop' as const;
}
