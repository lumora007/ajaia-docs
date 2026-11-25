import mammoth from "mammoth";
import { marked } from "marked";
import { AppError } from "./errors";
import { sanitizeDocHtml } from "./sanitize";
import { MAX_TITLE } from "./validation";

export const SUPPORTED_EXTENSIONS = [".txt", ".md", ".docx"] as const;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

// Mammoth ignores underline by default, and only treats numbered paragraphs as lists.
const DOCX_STYLE_MAP = ["u => u", "p[style-name='List Bullet'] => ul > li:fresh", "p[style-name='List Number'] => ol > li:fresh"];

const escapeHtml =(s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Plain text: blank lines separate paragraphs, single newlines become line breaks. */
export function textToHtml(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((para) => para.trim())
    .filter(Boolean)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

export function titleFromFilename(filename: string): string {
  const base = filename.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return (base || "Untitled document").slice(0, MAX_TITLE);
}

/** Converts an uploaded file into sanitized document HTML. Throws AppError for unsupported/invalid files. */
export async function convertUpload(filename: string, data: Buffer): Promise<{ title: string; html: string }> {
  const ext = (filename.match(/\.[^.]+$/)?.[0] ?? "").toLowerCase();
  if (!(SUPPORTED_EXTENSIONS as readonly string[]).includes(ext)) {
    throw new AppError(415, `Unsupported file type "${ext || "none"}". Supported: ${SUPPORTED_EXTENSIONS.join(", ")}.`);
  }
  if (data.byteLength > MAX_UPLOAD_BYTES) throw new AppError(413, "File is too large (max 2 MB).");
  if (data.byteLength === 0) throw new AppError(400, "The file is empty.");

  let html: string;
  if (ext === ".docx") {
    try {
      html = (await mammoth.convertToHtml({ buffer: data }, { styleMap: DOCX_STYLE_MAP })).value;
    } catch {
      throw new AppError(422, "Couldn't read that .docx file. Is it a valid Word document?");
    }
  } else {
    const text = data.toString("utf8");
    html = ext === ".md" ? await marked.parse(text, { gfm: true }) : textToHtml(text);
  }

  return { title: titleFromFilename(filename), html: sanitizeDocHtml(html) };
}
