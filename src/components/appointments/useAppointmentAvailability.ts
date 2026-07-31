"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import type { AppointmentType, SlotStatus } from "@/src/lib/appointments";

type AvailabilityResponse = {
  doctorId: string;
  date: string;
  type: AppointmentType;
  slots: SlotStatus[];
  blockedReason: string | null;
  nextAvailable: { date: string; slot: SlotStatus } | null;
};

export function useAppointmentAvailability(
  doctorId: string,
  date: string,
  type: AppointmentType,
) {
  const { accessToken } = useRole();
  const [data, setData] = useState<AvailabilityResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!doctorId || !date) {
      setData(null);
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const params = new URLSearchParams({
          doctor_id: doctorId,
          date,
          type,
          scan_days: "14",
        });
        const response = await fetch(`/api/v2/appointments/availability?${params.toString()}`, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
          cache: "no-store",
          signal: controller.signal,
        });

        const body = (await response.json()) as AvailabilityResponse & { message?: string };
        if (!response.ok) {
          throw new Error(body.message ?? "Failed to load slot availability.");
        }

        if (controller.signal.aborted) return;
        setData(body);
      } catch (loadError) {
        if ((loadError as Error).name === "AbortError") return;
        if (controller.signal.aborted) return;
        setError(loadError instanceof Error ? loadError.message : "Failed to load slot availability.");
        setData(null);
      } finally {
        if (controller.signal.aborted) return;
        setIsLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [accessToken, doctorId, date, type]);

  return {
    slotStatuses: data?.slots ?? [],
    blockedReason: data?.blockedReason ?? null,
    nextAvailableSlot: data?.nextAvailable ?? null,
    isLoading,
    error,
  };
}
