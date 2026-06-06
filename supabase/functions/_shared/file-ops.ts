// Pure file-content helpers shared by the file-writing Edge Functions.
// Extracted from update-file so the data-safety-critical merge logic can be
// unit-tested in isolation (see file-ops.test.ts). Behaviour MUST stay
// identical — these functions encode the safeguards described in CLAUDE.md
// "Data Safety". Only the YAML codec is imported; everything else is pure.
import {
  parse as parseYAML,
  stringify as stringifyYAML,
} from "https://deno.land/std@0.168.0/encoding/yaml.ts";

/**
 * Parse a markdown file with YAML frontmatter into { frontmatter, body }.
 */
export function parseMarkdownFile(
  content: string,
): { frontmatter: Record<string, any>; body: string } {
  if (!content.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  const parts = content.split("---", 3);
  if (parts.length < 3) {
    return { frontmatter: {}, body: content };
  }

  const yamlContent = parts[1];
  const body = parts[2];

  try {
    const frontmatter = (parseYAML(yamlContent) as Record<string, any>) || {};
    return { frontmatter, body };
  } catch (e) {
    console.error("YAML parse error:", e);
    return { frontmatter: {}, body: content };
  }
}

/**
 * Generate a markdown file from frontmatter + body.
 */
export function generateMarkdownFile(
  frontmatter: Record<string, any>,
  body: string,
): string {
  const yamlStr = stringifyYAML(frontmatter);
  return `---\n${yamlStr}---${body}`;
}

/**
 * Merge `updates` onto `current`, preserving unedited fields.
 *
 * DATA-SAFETY INVARIANTS (do not regress — see CLAUDE.md "Data Safety"):
 *  - null / undefined values never overwrite existing data.
 *  - An EMPTY STRING never clobbers an existing value. The admin edit form
 *    submits every text field via .trim(); a field left blank (or one the form
 *    never loaded) arrives as "" and must be treated as "no change", not
 *    "erase" — this is the same data-loss class as the 2026-06-02 wipe.
 *  - An EMPTY ARRAY never clobbers an existing value (the admin edit form
 *    submits every array field; a blank/unloaded field arrives as [] and must
 *    be treated as "no change", not "erase").
 *  - Plain objects are deep-merged one level (e.g. contact, location).
 *  - The input `current` object is not mutated.
 *
 * Note: real values false / 0 are preserved (only "" is skipped). To
 * intentionally clear a field a caller must send an explicit signal, not "".
 */
export function mergeUpdates(
  current: Record<string, any>,
  updates: Record<string, any>,
): Record<string, any> {
  const merged = { ...current };

  for (const [key, value] of Object.entries(updates)) {
    if (value === null || value === undefined) {
      // Don't overwrite with null/undefined
      continue;
    }

    // Don't let a blank text field clobber existing content.
    if (value === "") {
      continue;
    }

    // Don't let an empty array clobber an existing populated array.
    if (Array.isArray(value) && value.length === 0) {
      continue;
    }

    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      // Deep merge objects (e.g., elected_representatives, contact). Recurse
      // so the skip rules above (null/undefined/""/[]) apply at every level —
      // a blank nested field (e.g. contact.phone="") must not wipe the real one.
      if (
        typeof merged[key] === "object" &&
        !Array.isArray(merged[key]) &&
        merged[key] !== null
      ) {
        merged[key] = mergeUpdates(merged[key], value);
      } else {
        merged[key] = value;
      }
    } else {
      // Simple assignment for primitives and arrays
      merged[key] = value;
    }
  }

  return merged;
}
