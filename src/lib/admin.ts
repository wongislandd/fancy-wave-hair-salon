import { format } from "date-fns";
import { z } from "zod";
import type { Appointment } from "./types";

export const serviceFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  description: z.string().trim().min(5, "Description is required"),
  durationMinutes: z.coerce.number().int().min(15).max(360),
  priceDollars: z.coerce.number().min(0).max(1000),
  isActive: z.boolean()
});

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;

export function groupAppointmentsByDay(
  appointments: Appointment[]
): Record<string, Appointment[]> {
  return appointments.reduce<Record<string, Appointment[]>>(
    (groups, appointment) => {
      const key = format(new Date(appointment.startsAt), "yyyy-MM-dd");
      groups[key] = groups[key] ?? [];
      groups[key].push(appointment);
      return groups;
    },
    {}
  );
}

export function appointmentStatusLabel(status: Appointment["status"]): string {
  if (status === "confirmed") return "Confirmed";
  if (status === "cancelled") return "Cancelled";
  return "Completed";
}
