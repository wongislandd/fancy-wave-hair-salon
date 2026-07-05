/// <reference types="npm:@types/node@20" />
// @deno-types="npm:@types/nodemailer@6.4.17"
import nodemailer from "nodemailer";
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const allowedKinds = new Set([
  "booking_confirmation",
  "booking_rescheduled",
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

  const managementToken = body.managementToken?.trim();
  if (!managementToken) {
    return json({ error: "A management token is required" }, 400);
  }

  const supabase = createAdminClient();
  const tokenHash = await sha256Hex(managementToken);

  const appointment = await loadAppointment({
    appointmentId: body.appointmentId,
    supabase,
    tokenHash
  });

  if (!appointment) {
    return json({ error: "Appointment not found" }, 404);
  }

  if (appointment.management_token_hash !== tokenHash) {
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
      html: message.html
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

async function loadAppointment({
  appointmentId,
  supabase,
  tokenHash
}: {
  appointmentId?: string;
  supabase: SupabaseClient;
  tokenHash: string;
}): Promise<AppointmentRow | null> {
  const baseQuery = supabase.from("appointments").select(appointmentColumns);
  const query = appointmentId?.trim()
    ? baseQuery.eq("id", appointmentId.trim())
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
  managementToken: string;
  settings: SalonSettingsRow;
  siteUrl: string;
  subject: string;
}) {
  const manageUrl =
    kind === "booking_cancelled"
      ? null
      : `${siteUrl}/manage-booking/${encodeURIComponent(managementToken)}`;
  const formattedRange = formatAppointmentRange(
    appointment.starts_at,
    appointment.ends_at,
    settings.timezone
  );
  const price = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(appointment.service_price_cents_snapshot / 100);
  const title = emailTitle(kind);
  const intro = emailIntro(kind);
  const chineseIntro = emailIntroZh(kind);
  const serviceZh = appointment.service_name_zh_snapshot?.trim();
  const notes = appointment.notes?.trim();

  const rows = [
    ["Booking reference", "预约编号", appointment.booking_reference],
    [
      "Service",
      "服务",
      serviceZh
        ? `${appointment.service_name_snapshot} / ${serviceZh}`
        : appointment.service_name_snapshot
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
            <h1 style="margin:12px 0 0;font-size:28px;line-height:1.2;color:#132d29;">${escapeHtml(title.en)}<br><span style="font-size:24px;">${escapeHtml(title.zh)}</span></h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 10px;font-size:16px;line-height:1.6;">Hi ${escapeHtml(appointment.customer_name)},</p>
            <p style="margin:0 0 8px;font-size:16px;line-height:1.6;">${escapeHtml(intro)}</p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.6;">${escapeHtml(chineseIntro)}</p>
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
            <div style="margin-top:28px;padding-top:20px;border-top:1px solid #dbe9e4;color:#4b615c;font-size:14px;line-height:1.6;">
              <strong style="color:#132d29;">${escapeHtml(settings.salon_name)}</strong><br>
              ${escapeHtml(salonAddress)}
              <div style="margin-top:16px;">
                <a href="${escapeHtml(directionsUrl)}" style="display:inline-block;border:1px solid #207563;color:#207563;text-decoration:none;border-radius:999px;padding:12px 18px;font-weight:700;">Get directions / 查看路线</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;

  const textLines = [
    `${title.en} / ${title.zh}`,
    "",
    `Hi ${appointment.customer_name},`,
    intro,
    chineseIntro,
    "",
    ...rows.map(([labelEn, labelZh, value]) => `${labelEn} / ${labelZh}: ${value}`),
    "",
    manageUrl ? `Manage booking / 管理预约: ${manageUrl}` : "",
    `Get directions / 查看路线: ${directionsUrl}`,
    "",
    `${settings.salon_name}`,
    salonAddress
  ].filter(Boolean);

  return {
    subject: bilingualSubject(kind, subject),
    html,
    text: textLines.join("\n")
  };
}

function emailTitle(kind: BookingEmailKind) {
  switch (kind) {
    case "booking_rescheduled":
      return { en: "Your appointment was updated", zh: "您的预约已更新" };
    case "booking_cancelled":
      return { en: "Your appointment was cancelled", zh: "您的预约已取消" };
    default:
      return { en: "Your appointment is confirmed", zh: "您的预约已确认" };
  }
}

function emailIntro(kind: BookingEmailKind): string {
  switch (kind) {
    case "booking_rescheduled":
      return "Here are the updated details for your Fancy Wave appointment.";
    case "booking_cancelled":
      return "Your Fancy Wave appointment has been cancelled.";
    default:
      return "We have received your booking. Here are your appointment details.";
  }
}

function emailIntroZh(kind: BookingEmailKind): string {
  switch (kind) {
    case "booking_rescheduled":
      return "以下是您在 Fancy Wave 的最新预约信息。";
    case "booking_cancelled":
      return "您在 Fancy Wave 的预约已取消。";
    default:
      return "我们已收到您的预约，以下是预约详情。";
  }
}

function bilingualSubject(kind: BookingEmailKind, fallback: string): string {
  switch (kind) {
    case "booking_rescheduled":
      return "Your Fancy Wave appointment was updated / 您的 Fancy Wave 预约已更新";
    case "booking_cancelled":
      return "Your Fancy Wave appointment was cancelled / 您的 Fancy Wave 预约已取消";
    default:
      return fallback.includes("/")
        ? fallback
        : "Your Fancy Wave appointment is confirmed / 您的 Fancy Wave 预约已确认";
  }
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
