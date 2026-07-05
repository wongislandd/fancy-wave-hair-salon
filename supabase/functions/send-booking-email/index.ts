/// <reference types="npm:@types/node@20" />
// @deno-types="npm:@types/nodemailer@6.4.17"
import nodemailer from "nodemailer";
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const allowedKinds = new Set([
  "booking_confirmation",
  "booking_rescheduled",
  "booking_modified",
  "booking_cancelled"
] as const);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};
const salonAddress = "135-45 Roosevelt Ave, Flushing, NY 11354";
const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(salonAddress)}`;

type BookingEmailKind =
  | "booking_confirmation"
  | "booking_rescheduled"
  | "booking_modified"
  | "booking_cancelled";

type BookingEmailRequest = {
  kind?: string;
  appointmentId?: string;
  managementToken?: string;
};

type AppointmentRow = {
  id: string;
  booking_reference: string;
  service_name_snapshot: string;
  service_name_zh_snapshot: string | null;
  service_duration_minutes_snapshot: number;
  service_price_cents_snapshot: number;
  service_price_max_cents_snapshot: number | null;
  service_price_is_starting_at_snapshot: boolean;
  stylist_name_snapshot: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  notes: string | null;
  starts_at: string;
  ends_at: string;
  status: string;
  management_token_hash: string;
};

type EmailLogRow = {
  id: string;
  recipient_email: string;
  subject: string;
};

type SalonSettingsRow = {
  salon_name: string;
  timezone: string;
};

const appointmentColumns = [
  "id",
  "booking_reference",
  "service_name_snapshot",
  "service_name_zh_snapshot",
  "service_duration_minutes_snapshot",
  "service_price_cents_snapshot",
  "service_price_max_cents_snapshot",
  "service_price_is_starting_at_snapshot",
  "stylist_name_snapshot",
  "customer_name",
  "customer_email",
  "customer_phone",
  "notes",
  "starts_at",
  "ends_at",
  "status",
  "management_token_hash"
].join(",");

let mailTransport: nodemailer.Transporter | null = null;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405, { allow: "POST" });
  }

  let body: BookingEmailRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.kind || !allowedKinds.has(body.kind as BookingEmailKind)) {
    return json({ error: "Invalid email kind" }, 400);
  }

  const supabase = createAdminClient();
  const managementToken = body.managementToken?.trim();
  const appointmentId = body.appointmentId?.trim();

  if (!managementToken && !appointmentId) {
    return json(
      { error: "A management token or appointment ID is required" },
      400
    );
  }

  if (!managementToken) {
    const hasStaffAccess = await verifyStaffAccess(request, supabase);
    if (!hasStaffAccess) {
      return json({ error: "Staff access required" }, 403);
    }
  }

  const tokenHash = managementToken
    ? await sha256Hex(managementToken)
    : undefined;

  const appointment = await loadAppointment({
    appointmentId,
    supabase,
    tokenHash
  });

  if (!appointment) {
    return json({ error: "Appointment not found" }, 404);
  }

  if (tokenHash && appointment.management_token_hash !== tokenHash) {
    return json({ error: "Appointment token does not match" }, 403);
  }

  const pendingLog = await loadPendingEmailLog({
    appointmentId: appointment.id,
    kind: body.kind as BookingEmailKind,
    supabase
  });

  if (!pendingLog) {
    return json({ ok: true, delivered: false, skipped: true });
  }

  try {
    const settings = await loadSalonSettings(supabase);
    const siteUrl = resolveSiteUrl(request);
    const message = buildEmail({
      appointment,
      kind: body.kind as BookingEmailKind,
      managementToken,
      settings,
      siteUrl,
      subject: pendingLog.subject
    });
    const transporter = getTransporter();
    const result = await transporter.sendMail({
      from: formatFromAddress(),
      to: pendingLog.recipient_email,
      subject: message.subject,
      text: message.text,
      html: message.html,
      icalEvent: {
        filename: message.calendar.filename,
        method: message.calendar.method,
        content: message.calendar.content
      }
    });

    await supabase
      .from("email_logs")
      .update({
        sent_at: new Date().toISOString(),
        last_error: null,
        provider_message_id:
          typeof result.messageId === "string" ? result.messageId : null
      })
      .eq("id", pendingLog.id);

    return json({ ok: true, delivered: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Email delivery failed";
    await supabase
      .from("email_logs")
      .update({ last_error: message })
      .eq("id", pendingLog.id);

    console.error("Booking email delivery failed", error);
    return json({ error: message }, 500);
  }
});

function createAdminClient() {
  const url = requireEnv("SUPABASE_URL");
  const key =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEYS");

  if (!key) {
    throw new Error("A Supabase service role or secret key is required");
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function verifyStaffAccess(
  request: Request,
  supabase: SupabaseClient
): Promise<boolean> {
  const token = bearerTokenFromRequest(request);
  if (!token) return false;

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) return false;

  const { data, error } = await supabase
    .from("staff_profiles")
    .select("user_id")
    .eq("user_id", authData.user.id)
    .maybeSingle();

  return !error && Boolean(data);
}

function bearerTokenFromRequest(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  return match?.[1]?.trim() || null;
}

async function loadAppointment({
  appointmentId,
  supabase,
  tokenHash
}: {
  appointmentId?: string;
  supabase: SupabaseClient;
  tokenHash?: string;
}): Promise<AppointmentRow | null> {
  const baseQuery = supabase.from("appointments").select(appointmentColumns);
  const trimmedAppointmentId = appointmentId?.trim();
  const query = trimmedAppointmentId
    ? baseQuery.eq("id", trimmedAppointmentId)
    : baseQuery.eq("management_token_hash", tokenHash);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return data as AppointmentRow | null;
}

async function loadPendingEmailLog({
  appointmentId,
  kind,
  supabase
}: {
  appointmentId: string;
  kind: BookingEmailKind;
  supabase: SupabaseClient;
}): Promise<EmailLogRow | null> {
  const { data, error } = await supabase
    .from("email_logs")
    .select("id, recipient_email, subject")
    .eq("appointment_id", appointmentId)
    .eq("kind", kind)
    .is("sent_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data as EmailLogRow | null;
}

async function loadSalonSettings(
  supabase: SupabaseClient
): Promise<SalonSettingsRow> {
  const { data, error } = await supabase
    .from("salon_settings")
    .select("salon_name, timezone")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    salon_name: data?.salon_name ?? "Fancy Wave Hair Salon (Flushing)",
    timezone: data?.timezone ?? "America/New_York"
  };
}

function getTransporter(): nodemailer.Transporter {
  if (!mailTransport) {
    mailTransport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: requireEnv("GMAIL_USER"),
        pass: requireEnv("GMAIL_APP_PASSWORD")
      }
    });
  }

  return mailTransport;
}

function buildEmail({
  appointment,
  kind,
  managementToken,
  settings,
  siteUrl,
  subject
}: {
  appointment: AppointmentRow;
  kind: BookingEmailKind;
  managementToken?: string;
  settings: SalonSettingsRow;
  siteUrl: string;
  subject: string;
}) {
  const manageUrl =
    kind === "booking_cancelled" || !managementToken
      ? null
      : `${siteUrl}/manage-booking/${encodeURIComponent(managementToken)}`;
  const formattedRange = formatAppointmentRange(
    appointment.starts_at,
    appointment.ends_at,
    settings.timezone
  );
  const price = formatServicePrice(appointment);
  const copy = emailCopy(kind);
  const serviceZh = appointment.service_name_zh_snapshot?.trim();
  const notes = appointment.notes?.trim();
  const serviceName = serviceZh
    ? `${appointment.service_name_snapshot} / ${serviceZh}`
    : appointment.service_name_snapshot;
  const bookUrl = `${siteUrl}/book`;
  const calendar = buildCalendarEvent({
    appointment,
    kind,
    manageUrl,
    price,
    serviceName,
    settings
  });

  const rows: Array<[string, string, string]> = [
    ["Booking reference", "预约编号", appointment.booking_reference],
    [
      "Service",
      "服务",
      serviceName
    ],
    ["Stylist", "发型师", appointment.stylist_name_snapshot],
    ["Time", "时间", `${formattedRange.en} / ${formattedRange.zh}`],
    [
      "Duration",
      "时长",
      `${appointment.service_duration_minutes_snapshot} minutes / ${appointment.service_duration_minutes_snapshot} 分钟`
    ],
    ["Price", "价格", price]
  ];

  if (notes) {
    rows.push(["Notes", "备注", notes]);
  }

  const htmlRows = rows
    .map(
      ([labelEn, labelZh, value]) => `
        <tr>
          <td style="padding:12px 0;color:#4b615c;font-size:13px;width:155px;">${escapeHtml(labelEn)}<br><span style="color:#6c817b;">${escapeHtml(labelZh)}</span></td>
          <td style="padding:12px 0;color:#132d29;font-size:15px;font-weight:700;">${escapeHtml(value)}</td>
        </tr>`
    )
    .join("");

  const html = `
    <div style="margin:0;padding:0;background:#fbf7f1;font-family:Arial,'Microsoft YaHei',sans-serif;color:#132d29;">
      <div style="max-width:640px;margin:0 auto;padding:32px 18px;">
        <div style="background:#ffffff;border:1px solid #dbe9e4;border-radius:16px;overflow:hidden;">
          <div style="padding:28px 28px 18px;background:#edf8f5;">
            <div style="color:#0e6b59;font-size:13px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;">Fancy Wave Hair Salon (Flushing)</div>
            <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;color:#132d29;">${escapeHtml(copy.title.en)}<br><span style="font-size:24px;">${escapeHtml(copy.title.zh)}</span></h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 10px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(appointment.customer_name)},</p>
            <p style="margin:0 0 8px;font-size:16px;line-height:1.6;">${escapeHtml(copy.intro.en)}</p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">${escapeHtml(copy.intro.zh)}</p>
            ${
              kind === "booking_cancelled"
                ? `<div style="margin:0 0 22px;padding:16px;border:1px solid #f0d4c7;border-radius:14px;background:#fff8f5;color:#5f2c20;font-size:14px;line-height:1.6;">
                    <strong style="display:block;margin-bottom:6px;color:#3b1d16;">Cancellation notice / 取消通知</strong>
                    This appointment is no longer on our schedule. If this was unexpected, please reply to this email and our team will help you.<br>
                    此预约已从我们的日程中取消。如有疑问，请直接回复此邮件，我们会协助您处理。
                  </div>`
                : ""
            }
            <div style="margin:0 0 12px;color:#132d29;font-size:15px;font-weight:700;">${escapeHtml(copy.detailsHeading.en)} / ${escapeHtml(copy.detailsHeading.zh)}</div>
            <table role="presentation" style="width:100%;border-collapse:collapse;border-top:1px solid #dbe9e4;border-bottom:1px solid #dbe9e4;">
              ${htmlRows}
            </table>
            ${
              manageUrl
                ? `<div style="margin-top:28px;">
                    <a href="${escapeHtml(manageUrl)}" style="display:inline-block;background:#207563;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:700;">Manage booking / 管理预约</a>
                  </div>
                  <p style="margin:16px 0 0;color:#4b615c;font-size:13px;line-height:1.6;">If the button does not work, copy this link:<br>${escapeHtml(manageUrl)}</p>`
                : ""
            }
            ${
              kind !== "booking_cancelled"
                ? `<div style="margin-top:22px;padding:18px;border:1px solid #dbe9e4;border-radius:14px;background:#fbfdfc;">
                    <div style="margin-bottom:12px;color:#132d29;font-size:15px;font-weight:700;">Add to calendar / 加入日历</div>
                    <a href="${escapeHtml(calendar.googleUrl)}" style="display:inline-block;background:#207563;color:#ffffff;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;margin-right:8px;margin-bottom:8px;">Google Calendar</a>
                    <a href="${escapeHtml(calendar.outlookUrl)}" style="display:inline-block;border:1px solid #207563;color:#207563;text-decoration:none;border-radius:999px;padding:11px 17px;font-weight:700;margin-bottom:8px;">Outlook</a>
                    <p style="margin:8px 0 0;color:#4b615c;font-size:13px;line-height:1.6;">Apple Calendar, phone calendars, and other calendar apps can use the attached .ics file.<br>Apple、手机日历和其他日历应用可以打开附件中的 .ics 文件。</p>
                  </div>`
                : `<div style="margin-top:22px;padding:18px;border:1px solid #f0d4c7;border-radius:14px;background:#fff8f5;">
                    <div style="margin-bottom:8px;color:#3b1d16;font-size:15px;font-weight:700;">Calendar cancellation / 日历取消</div>
                    <p style="margin:0;color:#5f2c20;font-size:13px;line-height:1.6;">A cancellation .ics file is attached so supported calendar apps can remove or mark this event as cancelled.<br>邮件已附上取消预约的 .ics 文件，支持的日历应用可删除或标记此活动为已取消。</p>
                  </div>
                  <div style="margin-top:22px;">
                    <a href="${escapeHtml(bookUrl)}" style="display:inline-block;background:#207563;color:#ffffff;text-decoration:none;border-radius:999px;padding:14px 22px;font-weight:700;">Book a new appointment / 重新预约</a>
                  </div>`
            }
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #dbe9e4;color:#4b615c;font-size:14px;line-height:1.6;">
              <strong style="color:#132d29;">${escapeHtml(settings.salon_name)}</strong><br>
              ${escapeHtml(salonAddress)}
              ${
                kind !== "booking_cancelled"
                  ? `<div style="margin-top:16px;">
                      <a href="${escapeHtml(directionsUrl)}" style="display:inline-block;border:1px solid #207563;color:#207563;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;">Get directions / 查看路线</a>
                    </div>`
                  : ""
              }
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const textLines = [
    `${copy.title.en} / ${copy.title.zh}`,
    "",
    `Hi ${appointment.customer_name},`,
    copy.intro.en,
    copy.intro.zh,
    "",
    `${copy.detailsHeading.en} / ${copy.detailsHeading.zh}`,
    ...rows.map(([labelEn, labelZh, value]) => `${labelEn} / ${labelZh}: ${value}`),
    "",
    manageUrl ? `Manage booking / 管理预约: ${manageUrl}` : "",
    kind !== "booking_cancelled"
      ? `Add to Google Calendar / 加入 Google 日历: ${calendar.googleUrl}`
      : "",
    kind !== "booking_cancelled"
      ? `Add to Outlook / 加入 Outlook 日历: ${calendar.outlookUrl}`
      : "",
    kind !== "booking_cancelled"
      ? "Apple Calendar / Outlook desktop / phone calendars: open the attached .ics file."
      : "Calendar cancellation / 日历取消: open the attached .ics file to remove or mark this event as cancelled.",
    kind !== "booking_cancelled" ? `Get directions / 查看路线: ${directionsUrl}` : "",
    kind === "booking_cancelled" ? `Book a new appointment / 重新预约: ${bookUrl}` : "",
    "",
    `${settings.salon_name}`,
    salonAddress
  ].filter(Boolean);

  return {
    subject: bilingualSubject(kind, subject),
    html,
    text: textLines.join("\n"),
    calendar
  };
}

function buildCalendarEvent({
  appointment,
  kind,
  manageUrl,
  price,
  serviceName,
  settings
}: {
  appointment: AppointmentRow;
  kind: BookingEmailKind;
  manageUrl: string | null;
  price: string;
  serviceName: string;
  settings: SalonSettingsRow;
}) {
  const summary = "Appointment at Fancy Wave Hair Salon";
  const description = [
    "Appointment at Fancy Wave Hair Salon (Flushing)",
    "Fancy Wave Hair Salon (Flushing) 美发预约",
    "",
    `Booking reference / 预约编号: ${appointment.booking_reference}`,
    `Service / 服务: ${serviceName}`,
    `Stylist / 发型师: ${appointment.stylist_name_snapshot}`,
    `Duration / 时长: ${appointment.service_duration_minutes_snapshot} minutes`,
    `Price / 价格: ${price}`,
    appointment.notes?.trim() ? `Notes / 备注: ${appointment.notes.trim()}` : "",
    manageUrl ? `Manage booking / 管理预约: ${manageUrl}` : "",
    `Get directions / 查看路线: ${directionsUrl}`,
    "",
    `${settings.salon_name}`,
    salonAddress
  ]
    .filter(Boolean)
    .join("\n");
  const method = kind === "booking_cancelled" ? "CANCEL" : "REQUEST";
  const url = manageUrl ?? directionsUrl;

  return {
    content: buildIcsContent({
      appointment,
      description,
      method,
      sequence:
        kind === "booking_rescheduled" ||
        kind === "booking_modified" ||
        kind === "booking_cancelled"
          ? 1
          : 0,
      status: kind === "booking_cancelled" ? "CANCELLED" : "CONFIRMED",
      summary,
      url
    }),
    filename: "fancy-wave-appointment.ics",
    googleUrl: buildGoogleCalendarUrl({
      appointment,
      description,
      summary,
      timezone: settings.timezone
    }),
    method,
    outlookUrl: buildOutlookCalendarUrl({
      appointment,
      description,
      summary
    })
  };
}

function buildGoogleCalendarUrl({
  appointment,
  description,
  summary,
  timezone
}: {
  appointment: AppointmentRow;
  description: string;
  summary: string;
  timezone: string;
}) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: summary,
    dates: `${formatIcsDate(appointment.starts_at)}/${formatIcsDate(
      appointment.ends_at
    )}`,
    details: description,
    location: salonAddress,
    ctz: timezone
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function buildOutlookCalendarUrl({
  appointment,
  description,
  summary
}: {
  appointment: AppointmentRow;
  description: string;
  summary: string;
}) {
  const params = new URLSearchParams({
    path: "/calendar/action/compose",
    rru: "addevent",
    subject: summary,
    startdt: new Date(appointment.starts_at).toISOString(),
    enddt: new Date(appointment.ends_at).toISOString(),
    body: description,
    location: salonAddress
  });

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

function buildIcsContent({
  appointment,
  description,
  method,
  sequence,
  status,
  summary,
  url
}: {
  appointment: AppointmentRow;
  description: string;
  method: string;
  sequence: number;
  status: string;
  summary: string;
  url: string;
}) {
  const gmailUser =
    Deno.env.get("GMAIL_USER")?.trim() ?? "fancywavehairsalon@gmail.com";
  const now = formatIcsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Fancy Wave Hair Salon//Booking Calendar//EN",
    "CALSCALE:GREGORIAN",
    `METHOD:${method}`,
    "BEGIN:VEVENT",
    `UID:fancy-wave-${appointment.id}@fancywavehairsalon.gmail`,
    `DTSTAMP:${now}`,
    `DTSTART:${formatIcsDate(appointment.starts_at)}`,
    `DTEND:${formatIcsDate(appointment.ends_at)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(salonAddress)}`,
    `STATUS:${status}`,
    `SEQUENCE:${sequence}`,
    "TRANSP:OPAQUE",
    `ORGANIZER;CN=${escapeIcsParam(
      "Fancy Wave Hair Salon"
    )}:mailto:${gmailUser}`,
    `ATTENDEE;CN=${escapeIcsParam(
      appointment.customer_name
    )};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${appointment.customer_email}`,
    `URL:${url}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ];

  return lines.map(foldIcsLine).join("\r\n");
}

function emailCopy(kind: BookingEmailKind) {
  switch (kind) {
    case "booking_rescheduled":
      return {
        title: { en: "Your appointment time has changed", zh: "您的预约时间已更改" },
        intro: {
          en: "We moved your Fancy Wave appointment. Please use the new time below.",
          zh: "我们已为您更改 Fancy Wave 的预约时间。请以以下新的时间为准。"
        },
        detailsHeading: { en: "New appointment time", zh: "新的预约时间" }
      };
    case "booking_modified":
      return {
        title: { en: "Your appointment details were updated", zh: "您的预约详情已更新" },
        intro: {
          en: "We updated the details for your Fancy Wave appointment. The appointment is still confirmed.",
          zh: "我们已更新您在 Fancy Wave 的预约详情。您的预约仍然有效。"
        },
        detailsHeading: { en: "Updated appointment details", zh: "更新后的预约详情" }
      };
    case "booking_cancelled":
      return {
        title: { en: "Your appointment has been cancelled", zh: "您的预约已取消" },
        intro: {
          en: "This email confirms that your Fancy Wave appointment was cancelled.",
          zh: "这封邮件确认您在 Fancy Wave 的预约已取消。"
        },
        detailsHeading: { en: "Cancelled appointment", zh: "已取消的预约" }
      };
    default:
      return {
        title: { en: "Your appointment is confirmed", zh: "您的预约已确认" },
        intro: {
          en: "Thank you for booking with Fancy Wave. We look forward to seeing you.",
          zh: "感谢您预约 Fancy Wave，我们期待为您服务。"
        },
        detailsHeading: { en: "Appointment details", zh: "预约详情" }
      };
  }
}

function bilingualSubject(kind: BookingEmailKind, fallback: string): string {
  switch (kind) {
    case "booking_rescheduled":
      return "Your Fancy Wave appointment time has changed / 您的 Fancy Wave 预约时间已更改";
    case "booking_modified":
      return "Your Fancy Wave appointment details were updated / 您的 Fancy Wave 预约详情已更新";
    case "booking_cancelled":
      return "Your Fancy Wave appointment has been cancelled / 您的 Fancy Wave 预约已取消";
    default:
      return fallback.includes("/")
        ? fallback
        : "Your Fancy Wave appointment is confirmed / 您的 Fancy Wave 预约已确认";
  }
}

function formatServicePrice(appointment: AppointmentRow): string {
  const base = formatPriceCents(appointment.service_price_cents_snapshot);

  if (appointment.service_price_is_starting_at_snapshot) {
    return `${base}+`;
  }

  const maxPrice = appointment.service_price_max_cents_snapshot;
  if (typeof maxPrice === "number" && maxPrice > appointment.service_price_cents_snapshot) {
    return `${base}-${formatPriceCents(maxPrice)}`;
  }

  return base;
}

function formatPriceCents(priceCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(priceCents / 100);
}

function formatIcsDate(value: string): string {
  return new Date(value)
    .toISOString()
    .replaceAll("-", "")
    .replaceAll(":", "")
    .replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll("\n", "\\n")
    .replaceAll(";", "\\;")
    .replaceAll(",", "\\,");
}

function escapeIcsParam(value: string): string {
  return `"${value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`;
}

function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let remaining = line;

  while (remaining.length > 75) {
    parts.push(remaining.slice(0, 75));
    remaining = remaining.slice(75);
  }

  parts.push(remaining);
  return parts.join("\r\n ");
}

function formatAppointmentRange(startsAt: string, endsAt: string, timezone: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const enDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: timezone
  }).format(start);
  const zhDate = new Intl.DateTimeFormat("zh-Hans", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: timezone
  }).format(start);
  const enTime = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone
  });
  const zhTime = new Intl.DateTimeFormat("zh-Hans", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone
  });

  return {
    en: `${enDate}, ${enTime.format(start)} - ${enTime.format(end)}`,
    zh: `${zhDate} ${zhTime.format(start)} - ${zhTime.format(end)}`
  };
}

function resolveSiteUrl(request: Request): string {
  const configured = Deno.env.get("PUBLIC_SITE_URL")?.trim();
  const origin = request.headers.get("origin")?.trim();
  const value = configured || origin || "http://localhost:5173";

  return value.replace(/\/+$/, "");
}

function formatFromAddress(): string {
  const name =
    Deno.env.get("GMAIL_FROM_NAME")?.trim() ??
    "Fancy Wave Hair Salon (Flushing)";
  const email = requireEnv("GMAIL_USER");

  return `"${name.replaceAll('"', "'")}" <${email}>`;
}

function requireEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) {
    throw new Error(`${name} is not set`);
  }

  return value;
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);

  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function json(
  body: Record<string, unknown>,
  status = 200,
  extraHeaders: HeadersInit = {}
) {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders
    }
  });
}
