const PARAM_ORDER: Record<string, string[]> = {
  crsi: ["length"],
  tdfi: ["length", "upper", "lower"],
  adxvma: ["length"],
  ema: ["length"],
  sma: ["length"],
};

export function formatTvIndicatorLabel(
  indicatorName: string,
  params?: Record<string, number | string> | null
): string {
  const base = indicatorName.toUpperCase();
  if (!params) return base;

  const order = PARAM_ORDER[indicatorName.toLowerCase()] ?? Object.keys(params).sort();
  const values = order
    .map((k) => params[k])
    .filter((v) => v !== undefined && v !== null)
    .map((v) => String(v));

  return values.length ? `${base} (${values.join(", ")})` : base;
}