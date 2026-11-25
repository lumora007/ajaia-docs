import sanitizeHtml from "sanitize-html";

/**
 * Allowlist matches what the editor can produce (TipTap StarterKit). Everything else is stripped
 * (text content kept), so imported files and API writes can never store scripts or arbitrary markup.
 */
const options: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "h1", "h2", "h3", "strong", "b", "em", "i", "u", "s", "code", "pre", "blockquote", "ul", "ol", "li", "hr", "a"],
  allowedAttributes: { a: ["href", "target", "rel"], ol: ["start"] },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    h4: "h3",
    h5: "h3",
    h6: "h3",
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer nofollow", target: "_blank" }),
  },
};

export function sanitizeDocHtml(html: string): string {
  return sanitizeHtml(html, options).trim();
}
