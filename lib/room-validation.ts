import { z } from "zod";
const requirement = z.enum(["entrance", "seating", "restroom"]);
const evidence = z.object({
  supports: z.boolean(),
  excerpt: z.string().min(1).max(2000),
  source: z.string().min(1).max(300),
  url: z
    .string()
    .url()
    .max(2000)
    .optional()
    .refine((value) => !value || value.startsWith("https://")),
  retrievedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().optional(),
});
export const createRoomSchema = z.object({
  mode: z.enum(["nexconn", "rehearsal"]),
  datasetMode: z.enum(["demo", "live"]),
  requirement,
  question: z.string().trim().min(10).max(1500).optional(),
  researchReceipt: z.string().min(40).max(32000).optional(),
  venue: z.object({
    id: z.string().min(1).max(200),
    name: z.string().min(1).max(300),
    address: z.string().max(1000),
    category: z.string().max(1000),
    rating: z.number().min(0).max(5).optional(),
    mapsUrl: z
      .string()
      .url()
      .max(2000)
      .optional()
      .refine((value) => !value || value.startsWith("https://")),
    evidence: z.object({
      entrance: z.array(evidence).max(10),
      seating: z.array(evidence).max(10),
      restroom: z.array(evidence).max(10),
    }),
  }),
});
export const messageSchema = z
  .object({
    id: z.uuid(),
    text: z.string().trim().min(3).max(2000),
    author: z.string().trim().min(2).max(60),
    requirement: requirement.optional(),
    answer: z.enum(["available", "unavailable", "unsure"]).optional(),
  })
  .refine(
    (value) => Boolean(value.requirement) === Boolean(value.answer),
    "Choose both a requirement and an answer.",
  );
