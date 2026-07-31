"use client";

import { useEffect, useState } from "react";
import { useRole } from "@/src/components/layout/RoleProvider";
import {
  CLINIC_CONSULTATION_HOURLY_RATE,
  ONLINE_CONSULTATION_HOURLY_RATE,
  normalizeConfiguredClinicConsultationRate,
  normalizeConfiguredOnlineConsultationRate,
} from "@/src/lib/consultation-pricing";

export type DoctorFees = {
  clinic: number;
  online: number;
};

/**
 * Reads consultation hourly rates for the currently-active doctor.
 * Falls back to the first active doctor returned by the API when no slug is provided.
 */
export function useDoctorFees(slug?: string): {
  fees: DoctorFees;
  isLoading: boolean;
} {
  const { accessToken, isLoading: authLoading } = useRole();
  const [fees, setFees] = useState<DoctorFees>({
    clinic: CLINIC_CONSULTATION_HOURLY_RATE,
    online: ONLINE_CONSULTATION_HOURLY_RATE,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    let active = true;

    async function load() {
      try {
        const res = await fetch("/api/v2/doctors", {
          headers: { Authorization: `Bearer ${accessToken}` },
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as {
          doctors: Array<{
            consultation_fee_clinic: number | string;
            consultation_fee_online: number | string;
            slug?: string;
          }>;
        };
        const match =
          (slug ? payload.doctors.find((d) => d.slug === slug) : undefined) ??
          payload.doctors[0];
        if (match && active) {
          setFees({
            clinic: normalizeConfiguredClinicConsultationRate(Number(match.consultation_fee_clinic ?? 0)),
            online: normalizeConfiguredOnlineConsultationRate(Number(match.consultation_fee_online ?? 0)),
          });
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, [accessToken, authLoading, slug]);

  return { fees, isLoading: loading };
}
