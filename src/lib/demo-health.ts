export type DemoScenario = "steady" | "gradual-change" | "noisy" | "missing-data";
export type DemoMetric = "glucose" | "pressure" | "steps" | "sleep" | "resting-heart-rate";

export type DemoDay = {
  day: number;
  glucoseMmol: number | null;
  systolic: number | null;
  diastolic: number | null;
  steps: number | null;
  sleepHours: number | null;
  restingHeartRate: number | null;
};

export type DemoSignalSummary = {
  metric: DemoMetric;
  title: string;
  unit: string;
  baseline: number | null;
  recent: number | null;
  baselineCount: number;
  recentCount: number;
  shifted: boolean;
};

export type DemoAnalysis = {
  ready: boolean;
  checkedDays: number;
  shiftedSignals: number;
  signals: DemoSignalSummary[];
};

const variation = [-0.18, 0.08, 0.02, -0.08, 0.16, -0.04, 0.1, -0.12, 0.04, 0.18, -0.06, 0.06, -0.1, 0.12];
const noisyVariation = [-0.72, 0.5, -0.35, 0.68, -0.62, 0.28, -0.18, 0.76, -0.48, 0.42, -0.8, 0.3, 0.55, -0.38];

export function createDemoSeries(scenario: DemoScenario): DemoDay[] {
  return Array.from({ length: 28 }, (_, index) => {
    const day = index + 1;
    const base = scenario === "noisy" ? noisyVariation[index % noisyVariation.length] : variation[index % variation.length];
    const changeProgress = scenario === "gradual-change" ? Math.max(0, day - 15) / 12 : 0;
    const missing = scenario === "missing-data" && [22, 24, 25, 27, 28].includes(day);
    const missingContext = scenario === "missing-data" && [21, 23, 26].includes(day);

    return {
      day,
      glucoseMmol: missing ? null : Number((7.1 + base * (scenario === "noisy" ? 1.2 : 1) + changeProgress * 0.95).toFixed(1)),
      systolic: missing ? null : Math.round(130 + base * (scenario === "noisy" ? 9 : 4) + changeProgress * 11),
      diastolic: missing ? null : Math.round(82 + base * (scenario === "noisy" ? 6 : 2) + changeProgress * 6),
      steps: missingContext ? null : Math.max(800, Math.round(6200 + base * 700 - changeProgress * 800)),
      sleepHours: missingContext ? null : Number(Math.max(4.2, 7.1 + base * 0.5 - changeProgress * 0.8).toFixed(1)),
      restingHeartRate: missingContext ? null : Math.round(69 + base * 3 + changeProgress * 5),
    };
  });
}

function median(values: number[]): number {
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function readMetric(day: DemoDay, metric: DemoMetric): number | null {
  switch (metric) {
    case "glucose": return day.glucoseMmol;
    case "pressure": return day.systolic;
    case "steps": return day.steps;
    case "sleep": return day.sleepHours;
    case "resting-heart-rate": return day.restingHeartRate;
  }
}

const metricInfo: Record<DemoMetric, { title: string; unit: string; floor: number }> = {
  glucose: { title: "রক্তে শর্করা", unit: "mmol/L", floor: 0.3 },
  pressure: { title: "সিস্টোলিক রক্তচাপ", unit: "mmHg", floor: 3 },
  steps: { title: "দৈনিক পদক্ষেপ", unit: "পদক্ষেপ", floor: 900 },
  sleep: { title: "ঘুম", unit: "ঘণ্টা", floor: 0.35 },
  "resting-heart-rate": { title: "বিশ্রামের হার্ট রেট", unit: "bpm", floor: 3 },
};

export function analyzeDemoSeries(series: DemoDay[]): DemoAnalysis {
  const baselineDays = series.slice(0, 14);
  const recentDays = series.slice(-7);
  const ready = series.length >= 14;

  const signals = (Object.keys(metricInfo) as DemoMetric[]).map((metric) => {
    const baselineValues = baselineDays.map((day) => readMetric(day, metric)).filter((value): value is number => value !== null);
    const recentValues = recentDays.map((day) => readMetric(day, metric)).filter((value): value is number => value !== null);
    const info = metricInfo[metric];
    const baseline = baselineValues.length >= 10 ? median(baselineValues) : null;
    const recent = recentValues.length >= 5 ? recentValues.reduce((sum, value) => sum + value, 0) / recentValues.length : null;
    const deviation = baseline === null || recent === null
      ? 0
      : Math.abs(recent - baseline) / Math.max(median(baselineValues.map((value) => Math.abs(value - baseline))), info.floor);

    return {
      metric,
      title: info.title,
      unit: info.unit,
      baseline,
      recent,
      baselineCount: baselineValues.length,
      recentCount: recentValues.length,
      shifted: ready && baseline !== null && recent !== null && deviation >= 2,
    };
  });

  return {
    ready,
    checkedDays: series.length,
    shiftedSignals: signals.filter((signal) => signal.shifted).length,
    signals,
  };
}

export function demoMetricValue(day: DemoDay, metric: DemoMetric): number | null {
  return readMetric(day, metric);
}
