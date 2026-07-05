export type BookingEmailKind =
  | "booking_confirmation"
  | "booking_rescheduled"
  | "booking_modified"
  | "booking_cancelled";

export type BookingEmailRequest = {
  kind: BookingEmailKind;
  appointmentId?: string;
  managementToken?: string;
};

export type FunctionClient = {
  functions: {
    invoke: (
      name: string,
      options: { body: BookingEmailRequest }
    ) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>;
  };
};

export async function sendBookingEmailBestEffort(
  client: FunctionClient,
  request: BookingEmailRequest
): Promise<void> {
  try {
    const { error } = await client.functions.invoke("send-booking-email", {
      body: request
    });

    if (error) {
      console.warn("Booking email was not sent", error);
    }
  } catch (error) {
    console.warn("Booking email was not sent", error);
  }
}
