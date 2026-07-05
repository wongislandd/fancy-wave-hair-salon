# Admin Add Appointment Design

## Context

Fancy Wave Hair Salon already has a two-sided booking flow. Customers choose a service,
stylist, and available time slot, then provide required contact details. Staff can view
appointments in list and calendar views, inspect appointment details, cancel confirmed
appointments, and manage services, stylists, and hours.

Admins also need to add appointments manually when a customer calls or otherwise books
outside the public web flow.

## Goals

- Let staff create a confirmed appointment from the admin UI.
- Require the same scheduling rules as customer booking: active service, active stylist,
  available slot, business hours, and no overlapping confirmed appointment for the stylist.
- Require only the customer name from staff.
- Let staff optionally capture phone and email when available.
- Show staff-created appointments in the existing appointment list, detail drawer, and
  calendar after creation.
- Keep the implementation aligned with existing React, TanStack Query, React Hook Form,
  Zod, Supabase RPC, and demo-data patterns.

## Non-Goals

- Do not create unassigned appointments.
- Do not allow freeform typed appointment times.
- Do not allow staff to book outside business hours.
- Do not allow staff to bypass overlap checks.
- Do not build customer lookup, deposits, email delivery, or recurring appointments.

## User Experience

Add an "Add appointment" action to the admin appointments view and calendar view. The
action opens a focused staff booking form.

The form follows the existing customer booking rhythm, with staff-oriented copy and fewer
required contact fields:

1. Select a service.
2. Select a stylist who offers that service.
3. Select a date and available slot generated from that service, stylist, business hours,
   stylist hours, existing confirmed appointments, and salon settings.
4. Enter customer details:
   - Name is required.
   - Phone is optional.
   - Email is optional.
   - Staff notes are optional.

After save, the modal/drawer closes, the admin appointment query is invalidated, and the
new appointment appears in the list and calendar.

## Data And API Design

Use the existing `appointments` table so staff-created bookings share the same list,
calendar, cancellation, notes, and history surfaces as customer-created bookings.

Add a staff-only creation path rather than reusing the public `create_appointment` RPC
directly. The staff path should:

- Require authenticated staff.
- Accept service id, stylist id, start time, customer name, optional customer email,
  optional customer phone, optional customer note, and optional internal note.
- Load the active service and active stylist.
- Verify the stylist offers the selected service.
- Calculate `ends_at` from the selected service duration.
- Verify the selected time is within business or stylist hours.
- Verify no overlapping confirmed appointment exists for that stylist.
- Insert appointment snapshots from the service and stylist.
- Create a booking reference and management token hash, even if no email is available.
- Insert an `appointment_events` row with `actor_type = 'staff'` and `event_type = 'booked'`.
- Skip customer email log creation when email is blank.

Because the current database columns require `customer_email` and `customer_phone`, the
staff path should store blank strings when staff does not have those contact details. The
admin list and detail drawer should render blank contact values as "Not provided" instead
of showing empty links or fake contact data.

## Demo Mode

Demo mode should mirror production behavior:

- Add a staff booking data function that uses demo services, stylists, hours, and
  appointments.
- Reuse or share slot availability checks with `getAvailableSlots`.
- Insert the appointment into `demoAppointments`.
- Generate a booking reference and management token for consistency.
- Preserve optional email and phone as empty strings to match the existing TypeScript
  appointment model.

## Validation

Client validation:

- Service is required.
- Stylist is required.
- Slot is required.
- Customer name must be at least two trimmed characters.
- Optional email must be a valid email only when present.
- Optional phone should accept blank values and require a minimal length only when present.

Server/RPC validation:

- Staff access is required.
- Service and stylist must be active.
- Stylist must offer the selected service.
- Start time must be inside availability.
- Overlap checks must run server-side.

## Testing

Add focused tests for:

- Staff RPC wrapper sends optional phone/email values correctly.
- Staff RPC wrapper maps successful confirmation data.
- Demo staff creation rejects overlapping stylist appointments.
- Demo staff creation rejects outside-hours slots.
- Demo staff creation accepts blank phone/email.
- Admin form validation requires name, service, stylist, and slot.

Run the existing verification commands after implementation:

```bash
npm test -- --run
npm run build
```

Run lint if the implementation touches enough UI to make style regressions likely:

```bash
npm run lint
```
