export type AppointmentType = "Clinic" | "Online";

export type AppointmentStatus =
  | "Pending"
  | "Confirmed"
  | "Checked In"
  | "In Progress"
  | "Completed";

export type Doctor = {
  id: string;
  name: string;
  specialty: string;
};

export type SlotMode = "Clinic" | "Online" | "Both";

export type SlotTemplate = {
  start: string;
  end: string;
  mode: SlotMode;
};

export type AppointmentRecord = {
  id: string;
  patientName: string;
  email: string;
  phone: string;
  doctorId: string;
  date: string;
  start: string;
  end: string;
  type: AppointmentType;
  reason: string;
  status: AppointmentStatus;
  queueNumber: number;
  meetingLink: string | null;
};

export type SlotStatus = {
  start: string;
  end: string;
  mode: SlotMode;
  bookedCount: number;
  queueNumbers: number[];
  activeType: AppointmentType | null;
  availableForType: boolean;
  isFull: boolean;
  reason: string;
  nextQueueNumber: number | null;
};

export type BlockedDayLookup = Record<string, { reason: string }>;

export const MAX_PATIENTS_PER_HOUR = 5;

export const DOCTORS: Doctor[] = [
  { id: "doctora-kulot-md", name: "Dr. Fatimah Al-Zahra T. Ditti", specialty: "Family Medicine and Aesthetic Medicine" },
];

export const SLOT_TEMPLATES_BY_DOCTOR: Record<string, SlotTemplate[]> = {
  "doctora-kulot-md": [
    { start: "08:00", end: "09:00", mode: "Both" },
    { start: "09:00", end: "10:00", mode: "Both" },
    { start: "10:00", end: "11:00", mode: "Both" },
    { start: "11:00", end: "12:00", mode: "Both" },
    { start: "13:00", end: "14:00", mode: "Both" },
    { start: "14:00", end: "15:00", mode: "Both" },
    { start: "15:00", end: "16:00", mode: "Both" },
    { start: "16:00", end: "17:00", mode: "Both" },
  ],
};

// All appointments now come from Supabase via /api/appointments.
// The old hardcoded INITIAL_APPOINTMENTS seed has been removed.

export function getDoctorById(doctorId: string) {
  return DOCTORS.find((doctor) => doctor.id === doctorId) ?? null;
}

export function formatDisplayDate(date: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
}

export function formatDisplayTime(time: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(`2026-01-01T${time}:00`));
}

export function formatRange(start: string, end: string) {
  return `${formatDisplayTime(start)} - ${formatDisplayTime(end)}`;
}

export function addDays(date: string, amount: number) {
  const nextDate = new Date(`${date}T00:00:00`);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate.toISOString().slice(0, 10);
}

function getAppointmentsForSlot(
  appointments: AppointmentRecord[],
  doctorId: string,
  date: string,
  start: string,
) {
  return appointments
    .filter(
      (appointment) =>
        appointment.doctorId === doctorId &&
        appointment.date === date &&
        appointment.start === start,
    )
    .sort((left, right) => left.queueNumber - right.queueNumber);
}

function supportsType(mode: SlotMode, type: AppointmentType) {
  return mode === "Both" || mode === type;
}

export function getSlotStatuses(
  doctorId: string,
  date: string,
  type: AppointmentType,
  appointments: AppointmentRecord[],
  blockedDays: BlockedDayLookup = {},
) {
  const templates = SLOT_TEMPLATES_BY_DOCTOR[doctorId] ?? [];
  const blockedDay = blockedDays[date] ?? null;

  return templates.map<SlotStatus>((slot) => {
    const bookings = getAppointmentsForSlot(appointments, doctorId, date, slot.start);
    const activeType = bookings[0]?.type ?? null;
    const bookedCount = bookings.length;
    const isFull = bookedCount >= MAX_PATIENTS_PER_HOUR;
    const scheduleSupportsType = supportsType(slot.mode, type);
    const typeConflict = activeType !== null && activeType !== type;
    const doctorBlocked = blockedDay !== null;
    const availableForType =
      scheduleSupportsType && !typeConflict && bookedCount < MAX_PATIENTS_PER_HOUR && !doctorBlocked;

    let reason = "Available";

    if (doctorBlocked) {
      reason = blockedDay.reason;
    } else if (!scheduleSupportsType) {
      reason = `${slot.mode} schedule only`;
    } else if (typeConflict) {
      reason = `${activeType} bookings already occupy this shared slot`;
    } else if (isFull) {
      reason = "Max of 5 patients reached";
    }

    return {
      start: slot.start,
      end: slot.end,
      mode: slot.mode,
      bookedCount,
      queueNumbers: bookings.map((booking) => booking.queueNumber),
      activeType,
      availableForType,
      isFull,
      reason,
      nextQueueNumber: availableForType ? bookedCount + 1 : null,
    };
  });
}

export function findNextAvailableSlot(
  doctorId: string,
  date: string,
  type: AppointmentType,
  appointments: AppointmentRecord[],
  blockedDays: BlockedDayLookup = {},
  daysToScan = 7,
) {
  for (let dayOffset = 0; dayOffset < daysToScan; dayOffset += 1) {
    const currentDate = addDays(date, dayOffset);
    const slot = getSlotStatuses(doctorId, currentDate, type, appointments, blockedDays).find(
      (candidate) => candidate.availableForType,
    );

    if (slot) {
      return {
        date: currentDate,
        slot,
      };
    }
  }

  return null;
}

export function getAppointmentSummary(appointments: AppointmentRecord[]) {
  const clinicCount = appointments.filter((appointment) => appointment.type === "Clinic").length;
  const onlineCount = appointments.length - clinicCount;
  const confirmedCount = appointments.filter(
    (appointment) =>
      appointment.status === "Confirmed"
      || appointment.status === "Checked In"
      || appointment.status === "Completed",
  ).length;
  const pendingCount = appointments.filter(
    (appointment) => appointment.status === "Pending",
  ).length;
  const checkedInCount = appointments.filter(
    (appointment) => appointment.status === "Checked In",
  ).length;

  return {
    total: appointments.length,
    clinicCount,
    onlineCount,
    confirmedCount,
    pendingCount,
    checkedInCount,
  };
}

export function createAppointmentRecord(
  input: Omit<AppointmentRecord, "id" | "end" | "status" | "queueNumber" | "meetingLink">,
  appointments: AppointmentRecord[],
  blockedDays: BlockedDayLookup = {},
) {
  if (input.type === "Online") {
    return null;
  }

  const slotStatuses = getSlotStatuses(
    input.doctorId,
    input.date,
    input.type,
    appointments,
    blockedDays,
  );
  const matchingSlot = slotStatuses.find((slot) => slot.start === input.start);

  if (!matchingSlot || !matchingSlot.availableForType || matchingSlot.nextQueueNumber === null) {
    return null;
  }

  return {
    ...input,
    id: `apt-${String(appointments.length + 1).padStart(3, "0")}`,
    end: matchingSlot.end,
    status: "Confirmed",
    queueNumber: matchingSlot.nextQueueNumber,
    meetingLink: null,
  } satisfies AppointmentRecord;
}

export function buildBlockedDayLookup(
  blockedDays: Array<{ doctorId: string; date: string; reason: string }>,
  doctorId: string,
) {
  return Object.fromEntries(
    blockedDays
      .filter((record) => record.doctorId === doctorId)
      .map((record) => [record.date, { reason: record.reason }]),
  ) as BlockedDayLookup;
}

export function buildMeetingLink(appointment: Pick<
  AppointmentRecord,
  "doctorId" | "date" | "start" | "queueNumber"
>) {
  const compactDate = appointment.date.replaceAll("-", "");
  const compactTime = appointment.start.replace(":", "");
  return `https://meet.doctora-kulot.app/${appointment.doctorId}-${compactDate}-${compactTime}-${appointment.queueNumber}`;
}

export function getWeekDates(startDate: string, length = 7) {
  return Array.from({ length }, (_, index) => addDays(startDate, index));
}
