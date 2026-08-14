import { NextResponse } from "next/server";
import { BOOKING_CLINIC_LOCATIONS } from "@/src/lib/clinic-schedule";

const WEATHER_REVALIDATE_SECONDS = 15 * 60;

type OpenMeteoCurrent = {
  temperature_2m?: unknown;
  weather_code?: unknown;
  is_day?: unknown;
  time?: unknown;
};

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent;
};

function weatherCodeLabel(code: number) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";

  return "Weather";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clinicId = searchParams.get("clinic");
  const clinic = BOOKING_CLINIC_LOCATIONS.find((item) => item.value === clinicId);

  if (!clinic) {
    return NextResponse.json({ message: "Unknown clinic location." }, { status: 400 });
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(clinic.coordinates.latitude));
  url.searchParams.set("longitude", String(clinic.coordinates.longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("timezone", "Asia/Manila");

  try {
    const response = await fetch(url, {
      next: { revalidate: WEATHER_REVALIDATE_SECONDS },
    });

    if (!response.ok) {
      return NextResponse.json({ message: "Weather unavailable." }, { status: 502 });
    }

    const data = (await response.json()) as OpenMeteoResponse;
    const temperature = data.current?.temperature_2m;
    const weatherCode = data.current?.weather_code;

    if (typeof temperature !== "number" || typeof weatherCode !== "number") {
      return NextResponse.json({ message: "Weather unavailable." }, { status: 502 });
    }

    return NextResponse.json(
      {
        clinicId: clinic.value,
        clinicName: clinic.label,
        condition: weatherCodeLabel(weatherCode),
        isDay: data.current?.is_day === 1,
        temperatureC: Math.round(temperature),
        updatedAt: typeof data.current?.time === "string" ? data.current.time : null,
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${WEATHER_REVALIDATE_SECONDS}, stale-while-revalidate=${WEATHER_REVALIDATE_SECONDS}`,
        },
      },
    );
  } catch {
    return NextResponse.json({ message: "Weather unavailable." }, { status: 502 });
  }
}
