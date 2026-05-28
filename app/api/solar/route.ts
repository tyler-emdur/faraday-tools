import { NextResponse } from "next/server";
import type { SolarResult } from "@/lib/types";

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, { headers: { "User-Agent": "FaradayTools/1.0" } });
    const data = await res.json();
    if (data[0]) return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
  } catch {}
  return null;
}

// Monthly solar irradiance distribution for Colorado Front Range (normalized factors)
const CO_MONTHLY_FACTORS = [0.58, 0.68, 0.83, 0.95, 1.05, 1.12, 1.08, 1.05, 0.98, 0.82, 0.62, 0.52];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function calcSolar(monthlyBill: number, lat: number): Omit<SolarResult, "address"> {
  const electricityRate = 0.135; // $/kWh — Colorado average
  const monthlyKwh = monthlyBill / electricityRate;
  const annualKwh = monthlyKwh * 12;

  // Adjust base irradiance by latitude (Colorado ~37–41°N)
  const latFactor = 1.0 - Math.abs(lat - 38) * 0.008;
  const annualSunHours = 5.5 * 365 * latFactor; // hours/year for CO
  const systemEfficiency = 0.80;

  const systemSizeKw = Math.ceil((annualKwh / (annualSunHours * systemEfficiency)) * 10) / 10;
  const costPerWatt = 2.85; // installed $/W after federal tax credit
  const systemCostAfterCredit = systemSizeKw * 1000 * costPerWatt;

  const monthlyProduction = CO_MONTHLY_FACTORS.map((f) =>
    Math.round(systemSizeKw * 30 * 5.5 * f * systemEfficiency)
  );
  const annualProductionKwh = monthlyProduction.reduce((a, b) => a + b, 0);
  const annualSavings = Math.round(annualProductionKwh * electricityRate);
  const monthlySavings = monthlyProduction.map((kwh) => Math.round(kwh * electricityRate));
  const paybackYears = parseFloat((systemCostAfterCredit / annualSavings).toFixed(1));
  const co2OffsetLbs = Math.round(annualProductionKwh * 0.386); // EPA avg 0.386 lbs CO2/kWh

  return { systemSizeKw, annualProductionKwh, annualSavings, paybackYears, monthlyProduction, monthlySavings, co2OffsetLbs };
}

export async function POST(req: Request) {
  const { address, monthlyBill } = await req.json();
  if (!address || !monthlyBill) return NextResponse.json({ error: "Address and monthly bill required" }, { status: 400 });

  const bill = parseFloat(monthlyBill);
  if (isNaN(bill) || bill < 20) return NextResponse.json({ error: "Please enter a valid monthly electric bill" }, { status: 400 });

  const coords = await geocode(address);
  const lat = coords?.lat ?? 40.0150; // default to Boulder

  const apiKey = process.env.NREL_API_KEY;
  if (apiKey && coords) {
    try {
      const url = `https://developer.nrel.gov/api/pvwatts/v8.json?api_key=${apiKey}&system_capacity=4&azimuth=180&tilt=20&array_type=1&module_type=1&losses=14&lat=${coords.lat}&lon=${coords.lon}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data?.outputs?.ac_monthly) {
        const monthlyProductionFromNREL: number[] = data.outputs.ac_monthly;
        const scalingFactor = bill / 135; // scale to user's actual bill
        const scaled = monthlyProductionFromNREL.map((v: number) => Math.round(v * scalingFactor));
        const annualProd = scaled.reduce((a: number, b: number) => a + b, 0);
        const elecRate = 0.135;
        const annualSav = Math.round(annualProd * elecRate);
        const sysKw = parseFloat((data.inputs.system_capacity * scalingFactor).toFixed(1));
        const result: SolarResult = {
          address,
          systemSizeKw: sysKw,
          annualProductionKwh: annualProd,
          annualSavings: annualSav,
          paybackYears: parseFloat(((sysKw * 1000 * 2.85) / annualSav).toFixed(1)),
          monthlyProduction: scaled,
          monthlySavings: scaled.map((v: number) => Math.round(v * elecRate)),
          co2OffsetLbs: Math.round(annualProd * 0.386),
        };
        return NextResponse.json(result);
      }
    } catch {}
  }

  // Fallback calculation
  const calc = calcSolar(bill, lat);
  return NextResponse.json({ address, ...calc } as SolarResult);
}

