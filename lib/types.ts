export type HailSeverity = "extreme" | "severe" | "moderate" | "minor" | "none";

export interface HailEvent {
  date: string;
  maxSizeIn: number;
  severity: HailSeverity;
  description: string;
}

export interface HailResult {
  address: string;
  lat: number;
  lon: number;
  events: HailEvent[];
  riskScore: number;
  riskLevel: "Critical" | "High" | "Moderate" | "Low";
  roofAssessment: string;
  lastEventDaysAgo: number | null;
}

export interface SolarResult {
  address: string;
  systemSizeKw: number;
  annualProductionKwh: number;
  annualSavings: number;
  paybackYears: number;
  monthlyProduction: number[];
  monthlySavings: number[];
  co2OffsetLbs: number;
}

export interface Lead {
  id: string;
  name: string;
  address: string;
  service: string;
  date: string;
  status: "New" | "Contacted" | "Scheduled" | "Closed";
  notes: string;
}
