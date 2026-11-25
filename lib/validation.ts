import { z } from "zod";

export const MAX_TITLE = 200;
export const MAX_CONTENT_BYTES = 1_000_000;

const title = z.string().trim().min(1, "Title can't be empty.").max(MAX_TITLE, `Title must be at most ${MAX_TITLE} characters.`);

export const signupSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80, "Name is too long."),
  email: z.email("Enter a valid email address.").trim().toLowerCase().max(254),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200, "Password is too long."),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required."),
  password: z.string().min(1, "Password is required."),
});

export const createDocSchema = z.object({ title: title.optional() });

export const updateDocSchema = z
  .object({
    title: title.optional(),
    contentHtml: z
      .string()
      .refine((s) => Buffer.byteLength(s, "utf8") <= MAX_CONTENT_BYTES, "Document is too large (max 1 MB).")
      .optional(),
  })
  .refine((v) => v.title !== undefined || v.contentHtml !== undefined, "Nothing to update.");

export const roleSchema = z.enum(["viewer", "editor"]);
export type ShareRole = z.infer<typeof roleSchema>;

export const shareSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, "Email is required."),
  role: roleSchema,
});

export const uuidSchema = z.uuid();
