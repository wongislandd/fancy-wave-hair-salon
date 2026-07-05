import { addDays } from "date-fns";
import { createStaffAppointment, saveStylistProfile } from "./admin-api";
import {
  cancelBookingByToken,
  createAppointment,
  getBookingByToken,
  rescheduleBookingByToken
} from "./booking-api";
import { dateKeyInTimeZone, deriveAvailableSlots } from "./booking";
import { sendBookingEmailBestEffort } from "./email-api";
import {
  demoAppointments,
  demoBusinessHours,
  demoGalleryPhotos,
  demoServices,
  demoSettings,
  demoStylistHours,
  demoStylists,
  demoTokenLookup
} from "./demo-data";
import { supabase } from "./supabase";
import type { RpcClient } from "./booking-api";
import type { StaffAppointmentRequest } from "./admin-api";
import type {
  Appointment,
  AppointmentConfirmation,
  AvailableSlot,
  BookingRequest,
  BusinessHour,
  GalleryPhoto,
  ManageableBooking,
  Service,
  Stylist,
  StylistHour
} from "./types";

const galleryBucketName = "gallery-photos";

type StylistSaveValues = {
  name: string;
  bio: string;
  specialties: string[];
  serviceIds: string[];
  isActive: boolean;
};

type GalleryPhotoSaveValues = {
  storagePath?: string;
  imageUrl?: string;
  altTextEn: string;
  altTextZh: string;
  caption?: string | null;
  isActive: boolean;
};

export async function listPublicServices(): Promise<Service[]> {
  if (!supabase) {
    return demoServices.filter((service) => service.isActive);
  }

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapService);
}

export async function listAdminServices(): Promise<Service[]> {
  if (!supabase) return [...demoServices].sort((a, b) => a.displayOrder - b.displayOrder);

  const { data, error } = await supabase
    .from("services")
    .select("*")
    .order("display_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapService);
}

export async function listPublicStylists(serviceId?: string): Promise<Stylist[]> {
  if (!supabase) {
    return demoStylists
      .filter((stylist) => stylist.isActive)
      .filter((stylist) => !serviceId || stylist.serviceIds.includes(serviceId))
      .sort((a, b) => a.displayOrder - b.displayOrder);
  }

  const { data, error } = await supabase
    .from("stylists")
    .select("*, stylist_services(service_id)")
    .eq("is_active", true)
    .order("display_order");

  if (error) throw new Error(error.message);
  return (data ?? [])
    .map(mapStylist)
    .filter((stylist) => !serviceId || stylist.serviceIds.includes(serviceId));
}

export async function listAdminStylists(): Promise<Stylist[]> {
  if (!supabase) return [...demoStylists].sort((a, b) => a.displayOrder - b.displayOrder);

  const { data, error } = await supabase
    .from("stylists")
    .select("*, stylist_services(service_id)")
    .order("display_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapStylist);
}

export async function listAdminAppointments(): Promise<Appointment[]> {
  if (!supabase) return [...demoAppointments].sort(byStartsAt);

  const { data, error } = await supabase
    .from("appointments")
    .select("*")
    .order("starts_at");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapAppointment);
}

export async function listPublicGalleryPhotos(): Promise<GalleryPhoto[]> {
  if (!supabase) {
    return [...demoGalleryPhotos]
      .filter((photo) => photo.isActive)
      .sort(byDisplayOrder);
  }

  const { data, error } = await supabase
    .from("gallery_photos")
    .select("*")
    .eq("is_active", true)
    .order("display_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapGalleryPhoto);
}

export async function listAdminGalleryPhotos(): Promise<GalleryPhoto[]> {
  if (!supabase) return [...demoGalleryPhotos].sort(byDisplayOrder);

  const { data, error } = await supabase
    .from("gallery_photos")
    .select("*")
    .order("display_order");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapGalleryPhoto);
}

export async function uploadGalleryPhoto(
  file: File,
  values: Pick<GalleryPhotoSaveValues, "altTextEn" | "altTextZh" | "isActive">
): Promise<GalleryPhoto> {
  const extension = extensionFromFileName(file.name);
  const storagePath = `gallery/${crypto.randomUUID()}${extension}`;

  if (!supabase) {
    const imageUrl = typeof URL !== "undefined" && "createObjectURL" in URL
      ? URL.createObjectURL(file)
      : "/assets/salon-hero.png";

    return saveGalleryPhoto({
      ...values,
      storagePath,
      imageUrl
    });
  }

  const { error } = await supabase.storage
    .from(galleryBucketName)
    .upload(storagePath, file, {
      cacheControl: "31536000",
      upsert: false
    });

  if (error) throw new Error(error.message);

  return saveGalleryPhoto({
    ...values,
    storagePath
  });
}

export async function saveGalleryPhoto(
  values: GalleryPhotoSaveValues,
  existingId?: string
): Promise<GalleryPhoto> {
  const altTextEn = values.altTextEn.trim() || values.altTextZh.trim();
  const altTextZh = values.altTextZh.trim() || values.altTextEn.trim();
  const caption = values.caption?.trim() || null;
  const now = new Date().toISOString();

  if (!supabase) {
    if (existingId) {
      const existing = demoGalleryPhotos.find((photo) => photo.id === existingId);
      if (!existing) throw new Error("Gallery photo not found");
      existing.altText = altTextEn;
      existing.altTextEn = altTextEn;
      existing.altTextZh = altTextZh;
      existing.caption = caption;
      existing.isActive = values.isActive;
      existing.updatedAt = now;
      return existing;
    }

    const photo: GalleryPhoto = {
      id: crypto.randomUUID(),
      storagePath: values.storagePath ?? `demo/gallery-${crypto.randomUUID()}.jpg`,
      imageUrl: values.imageUrl ?? "/assets/salon-hero.png",
      altText: altTextEn,
      altTextEn,
      altTextZh,
      caption,
      displayOrder: nextGalleryDisplayOrder(),
      isActive: values.isActive,
      createdAt: now,
      updatedAt: now
    };
    demoGalleryPhotos.push(photo);
    return photo;
  }

  if (existingId) {
    const { data, error } = await supabase
      .from("gallery_photos")
      .update({
        alt_text: altTextEn,
        alt_text_en: altTextEn,
        alt_text_zh: altTextZh,
        caption,
        is_active: values.isActive
      })
      .eq("id", existingId)
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return mapGalleryPhoto(data);
  }

  if (!values.storagePath) {
    throw new Error("Upload a gallery photo before saving");
  }

  const { data, error } = await supabase
    .from("gallery_photos")
    .insert({
      storage_path: values.storagePath,
      alt_text: altTextEn,
      alt_text_en: altTextEn,
      alt_text_zh: altTextZh,
      caption,
      display_order: await nextSupabaseGalleryDisplayOrder(),
      is_active: values.isActive
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return mapGalleryPhoto(data);
}

export async function updateGalleryPhotoOrder(photoIds: string[]): Promise<void> {
  const client = supabase;

  if (!client) {
    photoIds.forEach((id, index) => {
      const photo = demoGalleryPhotos.find((item) => item.id === id);
      if (photo) {
        photo.displayOrder = index + 1;
        photo.updatedAt = new Date().toISOString();
      }
    });
    return;
  }

  const updates = photoIds.map((id, index) =>
    client
      .from("gallery_photos")
      .update({ display_order: index + 1 })
      .eq("id", id)
  );
  const results = await Promise.all(updates);
  const failed = results.find((result) => result.error);
  if (failed?.error) throw new Error(failed.error.message);
}

export async function deleteGalleryPhoto(photo: GalleryPhoto): Promise<void> {
  if (!supabase) {
    const index = demoGalleryPhotos.findIndex((item) => item.id === photo.id);
    if (index >= 0) demoGalleryPhotos.splice(index, 1);
    demoGalleryPhotos
      .sort(byDisplayOrder)
      .forEach((item, itemIndex) => {
        item.displayOrder = itemIndex + 1;
        item.updatedAt = new Date().toISOString();
      });
    return;
  }

  const { error } = await supabase.from("gallery_photos").delete().eq("id", photo.id);
  if (error) throw new Error(error.message);

  const storageResult = await supabase.storage
    .from(galleryBucketName)
    .remove([photo.storagePath]);
  if (storageResult.error) throw new Error(storageResult.error.message);
}

export async function listBusinessHours(): Promise<BusinessHour[]> {
  if (!supabase) return [...demoBusinessHours].sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  const { data, error } = await supabase
    .from("business_hours")
    .select("*")
    .order("day_of_week");

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapBusinessHour);
}

export async function listStylistHours(stylistId: string): Promise<StylistHour[]> {
  if (!supabase) {
    return buildStylistHoursFor(stylistId, demoBusinessHours, demoStylistHours);
  }

  const [businessHoursResult, stylistHoursResult] = await Promise.all([
    supabase.from("business_hours").select("*").order("day_of_week"),
    supabase
      .from("stylist_hours")
      .select("*")
      .eq("stylist_id", stylistId)
      .order("day_of_week")
  ]);

  if (businessHoursResult.error) throw new Error(businessHoursResult.error.message);
  if (stylistHoursResult.error) throw new Error(stylistHoursResult.error.message);

  return buildStylistHoursFor(
    stylistId,
    (businessHoursResult.data ?? []).map(mapBusinessHour),
    (stylistHoursResult.data ?? []).map(mapStylistHour)
  );
}

export async function getAvailableSlots(
  service: Service,
  date: string,
  stylist?: Stylist | null
): Promise<AvailableSlot[]> {
  if (!supabase) {
    const stylists = stylist
      ? [stylist]
      : demoStylists.filter((item) => item.isActive && item.serviceIds.includes(service.id));

    return stylists
      .flatMap((availableStylist) =>
        deriveAvailableSlots({
          date,
          service,
          businessHours: businessHoursForStylist(availableStylist.id),
          existingAppointments: demoAppointments,
          salonTimeZone: demoSettings.timezone,
          slotIntervalMinutes: demoSettings.slotIntervalMinutes,
          stylistId: availableStylist.id,
          stylistName: availableStylist.name,
          now: new Date()
        })
      )
      .sort(bySlotStartThenStylist);
  }

  if (!stylist) {
    const stylists = await listPublicStylists(service.id);
    const slots = await Promise.all(
      stylists.map((availableStylist) => getAvailableSlots(service, date, availableStylist))
    );
    return slots.flat().sort(bySlotStartThenStylist);
  }

  const { data, error } = await supabase.rpc("get_available_slots", {
    p_service_id: service.id,
    p_stylist_id: stylist.id,
    p_date: date
  });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<{
    starts_at: string;
    ends_at: string;
    label: string;
  }>;
  return rows.map((row) => ({
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    label: row.label,
    stylistId: stylist.id,
    stylistName: stylist.name
  }));
}

export async function bookAppointment(
  request: BookingRequest
): Promise<AppointmentConfirmation> {
  if (!supabase) {
    const service = demoServices.find((item) => item.id === request.serviceId);
    if (!service) throw new Error("Service not found");
    const stylist = demoStylists.find(
      (item) =>
        item.id === request.stylistId &&
        item.isActive &&
        item.serviceIds.includes(request.serviceId)
    );
    if (!stylist) throw new Error("Stylist is not available for this service");

    const startsAt = request.startsAt;
    assertDemoSlotAvailable({
      service,
      stylistId: stylist.id,
      stylistName: stylist.name,
      startsAt,
      now: new Date()
    });

    const id = crypto.randomUUID();
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const endsAt = new Date(
      new Date(startsAt).getTime() + service.durationMinutes * 60_000
    ).toISOString();

    demoAppointments.push({
      id,
      bookingReference: `FW-${id.slice(0, 6).toUpperCase()}`,
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      serviceNameZhSnapshot: service.nameZh ?? service.name,
      serviceDurationMinutesSnapshot: service.durationMinutes,
      servicePriceCentsSnapshot: service.priceCents,
      servicePriceMaxCentsSnapshot: service.priceMaxCents ?? null,
      servicePriceIsStartingAtSnapshot: Boolean(service.priceIsStartingAt),
      customerName: request.customerName,
      customerEmail: request.customerEmail,
      customerPhone: request.customerPhone,
      stylistId: stylist.id,
      stylistNameSnapshot: stylist.name,
      notes: request.notes?.trim() || null,
      internalNotes: null,
      startsAt,
      endsAt,
      status: "confirmed",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    demoTokenLookup.set(token, id);

    return {
      appointmentId: id,
      bookingReference: `FW-${id.slice(0, 6).toUpperCase()}`,
      managementToken: token,
      startsAt,
      endsAt
    };
  }

  const confirmation = await createAppointment(asRpcClient(), request);
  await sendBookingEmailBestEffort(supabase, {
    appointmentId: confirmation.appointmentId,
    kind: "booking_confirmation",
    managementToken: confirmation.managementToken
  });
  return confirmation;
}

export async function bookStaffAppointment(
  request: StaffAppointmentRequest
): Promise<AppointmentConfirmation> {
  if (!supabase) {
    const service = demoServices.find((item) => item.id === request.serviceId);
    if (!service) throw new Error("Service not found");
    const stylist = demoStylists.find(
      (item) =>
        item.id === request.stylistId &&
        item.isActive &&
        item.serviceIds.includes(request.serviceId)
    );
    if (!stylist) throw new Error("Stylist is not available for this service");

    assertDemoSlotAvailable({
      service,
      stylistId: stylist.id,
      stylistName: stylist.name,
      startsAt: request.startsAt,
      now: new Date()
    });

    const id = crypto.randomUUID();
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    const bookingReference = `FW-${id.slice(0, 6).toUpperCase()}`;
    const endsAt = new Date(
      new Date(request.startsAt).getTime() + service.durationMinutes * 60_000
    ).toISOString();
    const now = new Date().toISOString();

    demoAppointments.push({
      id,
      bookingReference,
      serviceId: service.id,
      serviceNameSnapshot: service.name,
      serviceNameZhSnapshot: service.nameZh ?? service.name,
      serviceDurationMinutesSnapshot: service.durationMinutes,
      servicePriceCentsSnapshot: service.priceCents,
      servicePriceMaxCentsSnapshot: service.priceMaxCents ?? null,
      servicePriceIsStartingAtSnapshot: Boolean(service.priceIsStartingAt),
      customerName: request.customerName.trim(),
      customerEmail: request.customerEmail?.trim() ?? "",
      customerPhone: request.customerPhone?.trim() ?? "",
      stylistId: stylist.id,
      stylistNameSnapshot: stylist.name,
      notes: request.notes?.trim() || null,
      internalNotes: request.internalNotes?.trim() || null,
      startsAt: request.startsAt,
      endsAt,
      status: "confirmed",
      createdAt: now,
      updatedAt: now
    });
    demoTokenLookup.set(token, id);

    return {
      appointmentId: id,
      bookingReference,
      managementToken: token,
      startsAt: request.startsAt,
      endsAt
    };
  }

  const confirmation = await createStaffAppointment(asRpcClient(), request);
  if (request.customerEmail?.trim()) {
    await sendBookingEmailBestEffort(supabase, {
      appointmentId: confirmation.appointmentId,
      kind: "booking_confirmation",
      managementToken: confirmation.managementToken
    });
  }
  return confirmation;
}

export async function loadBookingByToken(
  token: string
): Promise<ManageableBooking | null> {
  if (!supabase) {
    const id = demoTokenLookup.get(token);
    const appointment = demoAppointments.find((item) => item.id === id);
    if (!appointment) return null;
    return {
      bookingReference: appointment.bookingReference,
      serviceId: appointment.serviceId,
      serviceName: appointment.serviceNameSnapshot,
      serviceNameZh: appointment.serviceNameZhSnapshot ?? appointment.serviceNameSnapshot,
      serviceDurationMinutes: appointment.serviceDurationMinutesSnapshot,
      servicePriceCents: appointment.servicePriceCentsSnapshot,
      servicePriceMaxCents: appointment.servicePriceMaxCentsSnapshot ?? null,
      servicePriceIsStartingAt: Boolean(appointment.servicePriceIsStartingAtSnapshot),
      customerName: appointment.customerName,
      customerEmail: appointment.customerEmail,
      customerPhone: appointment.customerPhone,
      stylistId: appointment.stylistId,
      stylistName: appointment.stylistNameSnapshot,
      notes: appointment.notes,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      canManageOnline: canCustomerManageOnline(appointment, new Date())
    };
  }

  return getBookingByToken(asRpcClient(), token);
}

export async function saveService(
  values: {
    nameEn: string;
    nameZh: string;
    descriptionEn: string;
    descriptionZh: string;
    durationMinutes: number;
    priceDollars: number;
    priceMaxDollars: number | null;
    priceIsStartingAt: boolean;
    isActive: boolean;
  },
  existingId?: string
): Promise<void> {
  const englishName = values.nameEn.trim() || values.nameZh.trim();
  const chineseName = values.nameZh.trim() || values.nameEn.trim();
  const englishDescription = values.descriptionEn.trim() || values.descriptionZh.trim();
  const chineseDescription = values.descriptionZh.trim() || values.descriptionEn.trim();
  const priceCents = dollarsToCents(values.priceDollars);
  const priceMaxCents = values.priceIsStartingAt
    ? null
    : values.priceMaxDollars === null
      ? null
      : dollarsToCents(values.priceMaxDollars);
  const payload = {
    name_en: englishName,
    name_zh: chineseName,
    description_en: englishDescription,
    description_zh: chineseDescription,
    duration_minutes: values.durationMinutes,
    price_cents: priceCents,
    price_max_cents: priceMaxCents,
    price_is_starting_at: values.priceIsStartingAt,
    is_active: values.isActive,
    display_order: demoServices.length + 1
  };

  if (!supabase) {
    if (existingId) {
      const service = demoServices.find((item) => item.id === existingId);
      if (!service) return;
      service.nameEn = englishName;
      service.nameZh = chineseName;
      service.descriptionEn = englishDescription;
      service.descriptionZh = chineseDescription;
      service.name = englishName;
      service.description = englishDescription;
      service.durationMinutes = values.durationMinutes;
      service.priceCents = priceCents;
      service.priceMaxCents = priceMaxCents;
      service.priceIsStartingAt = values.priceIsStartingAt;
      service.isActive = values.isActive;
    } else {
      demoServices.push({
        id: crypto.randomUUID(),
        nameEn: englishName,
        nameZh: chineseName,
        descriptionEn: englishDescription,
        descriptionZh: chineseDescription,
        name: englishName,
        description: englishDescription,
        durationMinutes: values.durationMinutes,
        priceCents,
        priceMaxCents,
        priceIsStartingAt: values.priceIsStartingAt,
        isActive: values.isActive,
        displayOrder: demoServices.length + 1
      });
    }
    return;
  }

  const query = existingId
    ? supabase.from("services").update(payload).eq("id", existingId)
    : supabase.from("services").insert(payload);
  const { error } = await query;
  if (error) throw new Error(error.message);
}

export async function saveStylist(
  values: StylistSaveValues,
  existingId?: string
): Promise<Stylist> {
  if (!supabase) {
    if (existingId) {
      const stylist = demoStylists.find((item) => item.id === existingId);
      if (!stylist) throw new Error("Stylist not found");
      stylist.name = values.name;
      stylist.bio = values.bio;
      stylist.specialties = values.specialties;
      stylist.serviceIds = values.serviceIds;
      stylist.isActive = values.isActive;
      return stylist;
    }

    const stylist: Stylist = {
      id: crypto.randomUUID(),
      name: values.name,
      bio: values.bio,
      specialties: values.specialties,
      serviceIds: values.serviceIds,
      isActive: values.isActive,
      displayOrder: demoStylists.length + 1
    };
    demoStylists.push(stylist);
    return stylist;
  }

  const stylistId = await saveStylistProfile(asRpcClient(), {
    id: existingId,
    ...values
  });

  const saved = (await listAdminStylists()).find((stylist) => stylist.id === stylistId);
  if (!saved) throw new Error("Stylist was saved but could not be loaded");
  return saved;
}

export async function updateStylistHour(
  hour: StylistHour,
  patch: Pick<StylistHour, "opensAt" | "closesAt" | "isClosed" | "usesSalonHours">
): Promise<void> {
  const next = {
    opensAt: patch.opensAt,
    closesAt: patch.closesAt,
    isClosed: patch.isClosed,
    usesSalonHours: patch.usesSalonHours
  };

  if (!supabase) {
    const index = demoStylistHours.findIndex(
      (item) => item.stylistId === hour.stylistId && item.dayOfWeek === hour.dayOfWeek
    );

    if (next.usesSalonHours) {
      if (index >= 0) demoStylistHours.splice(index, 1);
      return;
    }

    const override: StylistHour = {
      id: index >= 0 ? demoStylistHours[index].id : crypto.randomUUID(),
      stylistId: hour.stylistId,
      dayOfWeek: hour.dayOfWeek,
      opensAt: next.opensAt,
      closesAt: next.closesAt,
      isClosed: next.isClosed,
      usesSalonHours: false
    };

    if (index >= 0) {
      demoStylistHours[index] = override;
    } else {
      demoStylistHours.push(override);
    }
    return;
  }

  if (next.usesSalonHours) {
    const { error } = await supabase
      .from("stylist_hours")
      .delete()
      .eq("stylist_id", hour.stylistId)
      .eq("day_of_week", hour.dayOfWeek);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase.from("stylist_hours").upsert(
    {
      stylist_id: hour.stylistId,
      day_of_week: hour.dayOfWeek,
      opens_at: next.opensAt,
      closes_at: next.closesAt,
      is_closed: next.isClosed
    },
    { onConflict: "stylist_id,day_of_week" }
  );
  if (error) throw new Error(error.message);
}

export async function updateBusinessHour(
  hour: BusinessHour,
  patch: Pick<BusinessHour, "opensAt" | "closesAt" | "isClosed">
): Promise<void> {
  if (!supabase) {
    const target = demoBusinessHours.find((item) => item.id === hour.id);
    if (target) Object.assign(target, patch);
    return;
  }

  const { error } = await supabase
    .from("business_hours")
    .update({
      opens_at: patch.opensAt,
      closes_at: patch.closesAt,
      is_closed: patch.isClosed
    })
    .eq("id", hour.id);
  if (error) throw new Error(error.message);
}

export async function updateAppointmentInternalNotes(
  id: string,
  internalNotes: string
): Promise<void> {
  if (!supabase) {
    const appointment = demoAppointments.find((item) => item.id === id);
    if (appointment) {
      appointment.internalNotes = internalNotes.trim() || null;
      appointment.updatedAt = new Date().toISOString();
    }
    return;
  }

  const { error } = await supabase
    .from("appointments")
    .update({ internal_notes: internalNotes.trim() || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function cancelAppointmentAsStaff(id: string): Promise<void> {
  if (!supabase) {
    const appointment = demoAppointments.find((item) => item.id === id);
    if (appointment) {
      appointment.status = "cancelled";
      appointment.cancelledAt = new Date().toISOString();
      appointment.updatedAt = new Date().toISOString();
    }
    return;
  }

  const { data, error } = await supabase
    .from("appointments")
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancelled_reason: "Cancelled by staff"
    })
    .eq("id", id)
    .select("id, booking_reference, customer_email")
    .single();
  if (error) throw new Error(error.message);

  await queueAndSendStaffBookingEmailBestEffort({
    appointmentId: String(data.id),
    bookingReference: String(data.booking_reference),
    body: `Your booking reference ${String(data.booking_reference)} has been cancelled by the salon.`,
    kind: "booking_cancelled",
    recipientEmail: String(data.customer_email ?? ""),
    subject: "Your Fancy Wave appointment was cancelled"
  });
}

export async function rescheduleAppointmentAsStaff(
  id: string,
  newStartsAt: string
): Promise<void> {
  if (!supabase) {
    const appointment = demoAppointments.find((item) => item.id === id);
    if (!appointment) throw new Error("Appointment not found");
    assertDemoSlotAvailable({
      service: serviceFromAppointment(appointment),
      stylistId: appointment.stylistId,
      stylistName: appointment.stylistNameSnapshot,
      startsAt: newStartsAt,
      now: new Date(),
      excludedAppointmentId: appointment.id
    });
    appointment.startsAt = newStartsAt;
    appointment.endsAt = new Date(
      new Date(newStartsAt).getTime() +
        appointment.serviceDurationMinutesSnapshot * 60_000
    ).toISOString();
    appointment.updatedAt = new Date().toISOString();
    return;
  }

  const { data: existing, error: loadError } = await supabase
    .from("appointments")
    .select("*")
    .eq("id", id)
    .single();
  if (loadError) throw new Error(loadError.message);

  const endsAt = new Date(
    new Date(newStartsAt).getTime() +
      Number(existing.service_duration_minutes_snapshot) * 60_000
  ).toISOString();

  const { data, error } = await supabase
    .from("appointments")
    .update({
      starts_at: newStartsAt,
      ends_at: endsAt
    })
    .eq("id", id)
    .select("id, booking_reference, customer_email")
    .single();
  if (error) throw new Error(error.message);

  await logStaffAppointmentEventBestEffort({
    appointmentId: String(data.id),
    eventType: "rescheduled",
    metadata: {
      previous_starts_at: String(existing.starts_at),
      new_starts_at: newStartsAt
    }
  });
  await queueAndSendStaffBookingEmailBestEffort({
    appointmentId: String(data.id),
    bookingReference: String(data.booking_reference),
    body: `Your booking reference ${String(data.booking_reference)} has been rescheduled by the salon.`,
    kind: "booking_rescheduled",
    recipientEmail: String(data.customer_email ?? ""),
    subject: "Your Fancy Wave appointment was moved"
  });
}

export async function rescheduleManagedBooking(
  token: string,
  newStartsAt: string
): Promise<void> {
  if (!supabase) {
    const id = demoTokenLookup.get(token);
    const appointment = demoAppointments.find((item) => item.id === id);
    if (!appointment) throw new Error("Booking not found");
    enforceCustomerChangeCutoff(appointment, new Date());
    assertDemoSlotAvailable({
      service: serviceFromAppointment(appointment),
      stylistId: appointment.stylistId,
      stylistName: appointment.stylistNameSnapshot,
      startsAt: newStartsAt,
      now: new Date(),
      excludedAppointmentId: appointment.id
    });
    appointment.startsAt = newStartsAt;
    appointment.endsAt = new Date(
      new Date(newStartsAt).getTime() +
        appointment.serviceDurationMinutesSnapshot * 60_000
    ).toISOString();
    appointment.updatedAt = new Date().toISOString();
    return;
  }

  await rescheduleBookingByToken(asRpcClient(), token, newStartsAt);
  await sendBookingEmailBestEffort(supabase, {
    kind: "booking_rescheduled",
    managementToken: token
  });
}

export async function cancelManagedBooking(token: string): Promise<void> {
  if (!supabase) {
    const id = demoTokenLookup.get(token);
    const appointment = demoAppointments.find((item) => item.id === id);
    if (!appointment) throw new Error("Booking not found");
    enforceCustomerChangeCutoff(appointment, new Date());
    appointment.status = "cancelled";
    appointment.cancelledAt = new Date().toISOString();
    appointment.updatedAt = new Date().toISOString();
    return;
  }

  await cancelBookingByToken(asRpcClient(), token);
  await sendBookingEmailBestEffort(supabase, {
    kind: "booking_cancelled",
    managementToken: token
  });
}

export async function signInStaff(email: string, password: string): Promise<void> {
  if (!supabase) {
    throw new Error("Supabase is not configured");
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}

export async function signOutStaff(): Promise<void> {
  if (!supabase) {
    return;
  }
  await supabase.auth.signOut();
}

export async function isStaffSignedIn(): Promise<boolean> {
  if (!supabase) {
    return false;
  }
  const { data } = await supabase.auth.getSession();
  return Boolean(data.session);
}

export function nextBookableDates(count = 10): string[] {
  return Array.from({ length: count }, (_, index) =>
    dateKeyInTimeZone(addDays(new Date(), index + 1), demoSettings.timezone)
  );
}

function dollarsToCents(value: number): number {
  return Math.round(value * 100);
}

function mapService(row: Record<string, unknown>): Service {
  const nameEn = String(row.name_en ?? row.name ?? "");
  const nameZh = String(row.name_zh ?? "");
  const descriptionEn = String(row.description_en ?? row.description ?? "");
  const descriptionZh = String(row.description_zh ?? "");

  return {
    id: String(row.id),
    nameEn,
    nameZh,
    descriptionEn,
    descriptionZh,
    name: nameEn || nameZh,
    description: descriptionEn || descriptionZh,
    durationMinutes: Number(row.duration_minutes),
    priceCents: Number(row.price_cents),
    priceMaxCents: row.price_max_cents === null || row.price_max_cents === undefined
      ? null
      : Number(row.price_max_cents),
    priceIsStartingAt: Boolean(row.price_is_starting_at),
    isActive: Boolean(row.is_active),
    displayOrder: Number(row.display_order)
  };
}

function mapAppointment(row: Record<string, unknown>): Appointment {
  return {
    id: String(row.id),
    bookingReference: String(row.booking_reference),
    serviceId: String(row.service_id),
    serviceNameSnapshot: String(row.service_name_snapshot),
    serviceNameZhSnapshot: row.service_name_zh_snapshot
      ? String(row.service_name_zh_snapshot)
      : null,
    serviceDurationMinutesSnapshot: Number(row.service_duration_minutes_snapshot),
    servicePriceCentsSnapshot: Number(row.service_price_cents_snapshot),
    servicePriceMaxCentsSnapshot:
      row.service_price_max_cents_snapshot === null ||
      row.service_price_max_cents_snapshot === undefined
        ? null
        : Number(row.service_price_max_cents_snapshot),
    servicePriceIsStartingAtSnapshot: Boolean(row.service_price_is_starting_at_snapshot),
    customerName: String(row.customer_name),
    customerEmail: String(row.customer_email),
    customerPhone: String(row.customer_phone),
    stylistId: String(row.stylist_id),
    stylistNameSnapshot: String(row.stylist_name_snapshot),
    notes: row.notes ? String(row.notes) : null,
    internalNotes: row.internal_notes ? String(row.internal_notes) : null,
    startsAt: String(row.starts_at),
    endsAt: String(row.ends_at),
    status: row.status as Appointment["status"],
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    cancelledReason: row.cancelled_reason ? String(row.cancelled_reason) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapGalleryPhoto(row: Record<string, unknown>): GalleryPhoto {
  const storagePath = String(row.storage_path);
  const altTextEn = String(row.alt_text_en ?? row.alt_text ?? "");
  const altTextZh = String(row.alt_text_zh ?? row.alt_text_en ?? row.alt_text ?? "");

  return {
    id: String(row.id),
    storagePath,
    imageUrl: publicGalleryPhotoUrl(storagePath),
    altText: altTextEn || altTextZh,
    altTextEn,
    altTextZh,
    caption: row.caption ? String(row.caption) : null,
    displayOrder: Number(row.display_order),
    isActive: Boolean(row.is_active),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };
}

function mapBusinessHour(row: Record<string, unknown>): BusinessHour {
  return {
    id: String(row.id),
    dayOfWeek: Number(row.day_of_week),
    opensAt: String(row.opens_at).slice(0, 5),
    closesAt: String(row.closes_at).slice(0, 5),
    isClosed: Boolean(row.is_closed)
  };
}

function mapStylistHour(row: Record<string, unknown>): StylistHour {
  return {
    id: String(row.id),
    stylistId: String(row.stylist_id),
    dayOfWeek: Number(row.day_of_week),
    opensAt: String(row.opens_at).slice(0, 5),
    closesAt: String(row.closes_at).slice(0, 5),
    isClosed: Boolean(row.is_closed),
    usesSalonHours: false
  };
}

function mapStylist(row: Record<string, unknown>): Stylist {
  const nestedServices = Array.isArray(row.stylist_services)
    ? (row.stylist_services as Array<Record<string, unknown>>)
    : [];

  return {
    id: String(row.id),
    name: String(row.name),
    bio: String(row.bio ?? ""),
    specialties: Array.isArray(row.specialties)
      ? row.specialties.map(String)
      : [],
    serviceIds: nestedServices.map((item) => String(item.service_id)),
    isActive: Boolean(row.is_active),
    displayOrder: Number(row.display_order)
  };
}

function buildStylistHoursFor(
  stylistId: string,
  businessHours: BusinessHour[],
  stylistHours: StylistHour[]
): StylistHour[] {
  const overrides = new Map(
    stylistHours
      .filter((hour) => hour.stylistId === stylistId)
      .map((hour) => [hour.dayOfWeek, hour])
  );

  return businessHours
    .map((businessHour) => {
      const override = overrides.get(businessHour.dayOfWeek);
      if (override) return { ...override, usesSalonHours: false };

      return {
        id: `salon-hours-${stylistId}-${businessHour.dayOfWeek}`,
        stylistId,
        dayOfWeek: businessHour.dayOfWeek,
        opensAt: businessHour.opensAt,
        closesAt: businessHour.closesAt,
        isClosed: businessHour.isClosed,
        usesSalonHours: true
      };
    })
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

function businessHoursForStylist(stylistId: string): BusinessHour[] {
  return buildStylistHoursFor(stylistId, demoBusinessHours, demoStylistHours).map((hour) => ({
    id: hour.id,
    dayOfWeek: hour.dayOfWeek,
    opensAt: hour.opensAt,
    closesAt: hour.closesAt,
    isClosed: hour.isClosed
  }));
}

function assertDemoSlotAvailable({
  service,
  stylistId,
  stylistName,
  startsAt,
  now,
  excludedAppointmentId
}: {
  service: Service;
  stylistId: string;
  stylistName: string;
  startsAt: string;
  now: Date;
  excludedAppointmentId?: string;
}): void {
  const earliestStart = new Date(
    now.getTime() + demoSettings.minBookingNoticeMinutes * 60_000
  );
  const date = dateKeyInTimeZone(startsAt, demoSettings.timezone);
  const existingAppointments = excludedAppointmentId
    ? demoAppointments.filter((appointment) => appointment.id !== excludedAppointmentId)
    : demoAppointments;

  const matchingSlot = deriveAvailableSlots({
    date,
    service,
    businessHours: businessHoursForStylist(stylistId),
    existingAppointments,
    salonTimeZone: demoSettings.timezone,
    slotIntervalMinutes: demoSettings.slotIntervalMinutes,
    stylistId,
    stylistName,
    now: earliestStart
  }).some((slot) => slot.startsAt === startsAt);

  if (!matchingSlot) {
    throw new Error("Selected time is no longer available");
  }
}

function serviceFromAppointment(appointment: Appointment): Service {
  return {
    id: appointment.serviceId,
    nameEn: appointment.serviceNameSnapshot,
    nameZh: appointment.serviceNameZhSnapshot ?? appointment.serviceNameSnapshot,
    descriptionEn: "",
    descriptionZh: "",
    name: appointment.serviceNameSnapshot,
    description: "",
    durationMinutes: appointment.serviceDurationMinutesSnapshot,
    priceCents: appointment.servicePriceCentsSnapshot,
    priceMaxCents: appointment.servicePriceMaxCentsSnapshot ?? null,
    priceIsStartingAt: Boolean(appointment.servicePriceIsStartingAtSnapshot),
    isActive: true,
    displayOrder: 0
  };
}

function canCustomerManageOnline(appointment: Appointment, now: Date): boolean {
  if (appointment.status !== "confirmed") return false;

  const cutoffAt = new Date(
    now.getTime() + demoSettings.cancellationCutoffMinutes * 60_000
  );

  return new Date(appointment.startsAt) >= cutoffAt;
}

function enforceCustomerChangeCutoff(appointment: Appointment, now: Date): void {
  if (!canCustomerManageOnline(appointment, now)) {
    throw new Error("This booking can no longer be changed online");
  }
}

function byStartsAt(a: Appointment, b: Appointment): number {
  return new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
}

function byDisplayOrder(a: { displayOrder: number }, b: { displayOrder: number }): number {
  return a.displayOrder - b.displayOrder;
}

function bySlotStartThenStylist(a: AvailableSlot, b: AvailableSlot): number {
  const timeDelta = new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime();
  if (timeDelta !== 0) return timeDelta;
  return a.stylistName.localeCompare(b.stylistName);
}

function extensionFromFileName(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.(avif|gif|jpe?g|png|webp)$/);
  return match ? match[0] : ".jpg";
}

function nextGalleryDisplayOrder(): number {
  return Math.max(0, ...demoGalleryPhotos.map((photo) => photo.displayOrder)) + 1;
}

async function nextSupabaseGalleryDisplayOrder(): Promise<number> {
  if (!supabase) return nextGalleryDisplayOrder();

  const { data, error } = await supabase
    .from("gallery_photos")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Number(data?.display_order ?? 0) + 1;
}

function publicGalleryPhotoUrl(storagePath: string): string {
  if (!supabase) return "/assets/salon-hero.png";

  return supabase.storage.from(galleryBucketName).getPublicUrl(storagePath).data.publicUrl;
}

async function queueAndSendStaffBookingEmailBestEffort({
  appointmentId,
  bookingReference,
  body,
  kind,
  recipientEmail,
  subject
}: {
  appointmentId: string;
  bookingReference: string;
  body: string;
  kind: "booking_rescheduled" | "booking_modified" | "booking_cancelled";
  recipientEmail: string;
  subject: string;
}): Promise<void> {
  const client = supabase;
  const email = recipientEmail.trim();

  if (!client || !email) return;

  try {
    const { error } = await client.from("email_logs").insert({
      appointment_id: appointmentId,
      kind,
      recipient_email: email,
      subject,
      body
    });

    if (error) {
      console.warn("Booking email was not queued", error);
      return;
    }

    await sendBookingEmailBestEffort(client, {
      appointmentId,
      kind
    });
  } catch (error) {
    console.warn(
      `Booking email was not queued for ${bookingReference}`,
      error
    );
  }
}

async function logStaffAppointmentEventBestEffort({
  appointmentId,
  eventType,
  metadata
}: {
  appointmentId: string;
  eventType: "rescheduled" | "cancelled";
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const client = supabase;
  if (!client) return;

  try {
    const { error } = await client.from("appointment_events").insert({
      appointment_id: appointmentId,
      event_type: eventType,
      actor_type: "staff",
      metadata: metadata ?? {}
    });

    if (error) {
      console.warn("Appointment event was not logged", error);
    }
  } catch (error) {
    console.warn("Appointment event was not logged", error);
  }
}

function asRpcClient(): RpcClient {
  const client = supabase;
  if (!client) {
    throw new Error("Supabase is not configured");
  }

  return {
    rpc: async (name, params) => {
      const { data, error } = await client.rpc(name, params);
      return { data, error };
    }
  };
}
