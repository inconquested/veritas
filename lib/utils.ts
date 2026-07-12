import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ZodIssue, ZodType } from "zod";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function useInitial(username: string) {
  const names = username.split(" ");
  const initials = names.map((name) => name.charAt(0).toUpperCase()).splice(0,2);
  return initials.join("");
}

export const handleInputChange = (
  e: React.ChangeEvent<HTMLInputElement>,
  onChange: (name: string, value: any) => void,
) => {
  const { name, value } = e.target;
  onChange(name, value);
};

export function translateErrorKey(t: any, key: string) {
  const id = key.startsWith("errors.") ? key.slice(7) : key;

  try {
    return t(id);
  } catch {
    return key;
  }
}

export function formatZodIssues(issues: Pick<ZodIssue, "path" | "message">[]) {
  return issues.map((issue) => ({
    field: issue.path.join(".") || "_form",
    key: issue.message.startsWith("errors.")
      ? issue.message
      : "errors.validation_failed",
  }));
}

export function issuesToErrors(
  issues: { field: string; key: string }[] | undefined,
  t: any,
) {
  return (issues ?? []).reduce(
    (acc, issue) => {
      acc[issue.field] = translateErrorKey(t, issue.key);
      return acc;
    },
    {} as Record<string, string>,
  );
}

export function validateWithTranslation<T>(
  schema: ZodType<T>,
  data: unknown,
  t: any,
) {
  const result = schema.safeParse(data);

  if (!result.success) {
    return {
      success: false,
      errors: issuesToErrors(formatZodIssues(result.error.issues), t),
    };
  }

  return { success: true, data: result.data };
}

export function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? item.toString() : item,
    ),
  ) as T;
}

export function getErrorStateMessage(errorKey?: string | null) {
  if (!errorKey) return "We couldn't load this data right now.";

  if (errorKey.includes("unauthorized") || errorKey.includes("auth")) {
    return "Please sign in again to view this workspace.";
  }

  if (errorKey.includes("forbidden") || errorKey.includes("permission")) {
    return "You don't have permission to view this section yet.";
  }

  if (errorKey.includes("notExist") || errorKey.includes("not_found")) {
    return "This item could not be found.";
  }

  return "We couldn't load this data right now.";
}

export function formatInvoiceDate(date = new Date()) {
  const offset = date.getTimezoneOffset();
  const localDate = new Date(date.getTime() - (offset * 60 * 1000));
  return localDate.toISOString().split('T')[0];
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[\s\W-]+/g, "-") // Replace spaces and non-word characters with hyphens
    .replace(/^-+|-+$/g, ""); // Remove leading and trailing hyphens
}
