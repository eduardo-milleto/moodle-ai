export function sanitizeVisibleText(input: string) {
  return input
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/sesskey=[^&\s]+/gi, "sesskey=[redacted]")
    .replace(/token=[^&\s]+/gi, "token=[redacted]")
    .replace(/password=[^&\s]+/gi, "password=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60000);
}

export function sanitizeUrl(input: string) {
  try {
    const url = new URL(input);
    return `${url.origin}${url.pathname}`;
  } catch {
    return input.split("?")[0] ?? input;
  }
}

