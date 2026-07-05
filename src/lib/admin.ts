import { z } from "zod";
import { DEFAULT_SALON_TIME_ZONE, dateKeyInTimeZone } from "./booking";
import type { Language } from "./localization";
import type { Appointment } from "./types";

export const serviceFormSchema = z.object({
  nameEn: z.string().trim(),
  nameZh: z.string().trim(),
  descriptionEn: z.string().trim(),
  descriptionZh: z.string().trim(),
  durationMinutes: z.coerce.number().int().min(15).max(360),
  priceDollars: z.coerce.number().min(0).max(1000),
  isActive: z.boolean()
}).superRefine((values, context) => {
  if (!values.nameEn && !values.nameZh) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["nameEn"],
      message: "Enter an English or Chinese service name / 请输入英文或中文服务名称"
    });
  }

  if (!values.descriptionEn && !values.descriptionZh) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["descriptionEn"],
      message: "Enter an English or Chinese service description / 请输入英文或中文服务介绍"
    });
  }
});

export type ServiceFormValues = z.infer<typeof serviceFormSchema>;

export const stylistFormSchema = z.object({
  name: z.string().trim().min(2, "Name is required"),
  bio: z.string().trim().min(10, "Bio is required"),
  specialties: z.string().transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  ),
  serviceIds: z.array(z.string()).min(1, "Assign at least one service"),
  isActive: z.boolean()
});

export type StylistFormValues = z.infer<typeof stylistFormSchema>;

export const galleryPhotoFormSchema = z.object({
  altTextEn: z.string().trim(),
  altTextZh: z.string().trim(),
  isActive: z.boolean()
}).superRefine((values, context) => {
  if (values.altTextEn.length < 2 && values.altTextZh.length < 2) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["altTextEn"],
      message: "Enter an English or Chinese photo description / \u8bf7\u8f93\u5165\u82f1\u6587\u6216\u4e2d\u6587\u7167\u7247\u63cf\u8ff0"
    });
  }
});

export type GalleryPhotoFormValues = z.infer<typeof galleryPhotoFormSchema>;

export const staffAppointmentFormSchema = z.object({
  serviceId: z.string().trim().min(1, "Choose a service"),
  stylistId: z.string().trim().min(1, "Choose a stylist"),
  startsAt: z.string().trim().min(1, "Choose an available time"),
  customerName: z.string().trim().min(2, "Enter the guest name"),
  customerEmail: z
    .string()
    .trim()
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      "Enter a valid email"
    ),
  customerPhone: z
    .string()
    .trim()
    .refine((value) => !value || value.length >= 7, "Enter a phone number"),
  notes: z.string().trim().max(500).optional().or(z.literal("")),
  internalNotes: z.string().trim().max(500).optional().or(z.literal(""))
});

export type StaffAppointmentFormValues = z.infer<typeof staffAppointmentFormSchema>;

export function groupAppointmentsByDay(
  appointments: Appointment[],
  timeZone = DEFAULT_SALON_TIME_ZONE
): Record<string, Appointment[]> {
  return appointments.reduce<Record<string, Appointment[]>>(
    (groups, appointment) => {
      const key = dateKeyInTimeZone(appointment.startsAt, timeZone);
      groups[key] = groups[key] ?? [];
      groups[key].push(appointment);
      return groups;
    },
    {}
  );
}

export function customerHistoryForAppointment(
  appointments: Appointment[],
  appointment: Appointment
): Appointment[] {
  const customerEmail = appointment.customerEmail.trim().toLowerCase();
  if (!customerEmail) return [];

  const selectedStartsAt = new Date(appointment.startsAt).getTime();

  return appointments
    .filter(
      (item) =>
        item.id !== appointment.id &&
        item.customerEmail.trim().toLowerCase() === customerEmail &&
        new Date(item.startsAt).getTime() < selectedStartsAt
    )
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
}

export function appointmentStatusLabel(
  status: Appointment["status"],
  language: Language = "en"
): string {
  if (language === "zh") {
    if (status === "confirmed") return "已确认";
    if (status === "cancelled") return "已取消";
    return "已完成";
  }

  if (status === "confirmed") return "Confirmed";
  if (status === "cancelled") return "Cancelled";
  return "Completed";
}
