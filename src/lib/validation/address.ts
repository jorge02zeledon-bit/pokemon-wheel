import { z } from "zod";
import { US_STATE_CODES } from "../us-states";

/** US shipping address captured when a user requests shipping. */
export const shippingAddressSchema = z.object({
  recipientName: z.string().trim().min(2, "Enter the recipient's name").max(80),
  line1: z.string().trim().min(3, "Enter a street address").max(120),
  line2: z.string().trim().max(120).optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  city: z.string().trim().min(2, "Enter a city").max(80),
  state: z.string().trim().toUpperCase().refine((c) => US_STATE_CODES.has(c), "Select a state"),
  postalCode: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code"),
});

/** Parsed address; `line2` is optional. */
export type ShippingAddress = Omit<z.infer<typeof shippingAddressSchema>, "line2"> & { line2?: string };
