interface ValidationIssues {
  issues: ReadonlyArray<{ path: ReadonlyArray<PropertyKey>; message: string }>;
}

/** The first message for each field in a failed schema parse, keyed by field name. */
export function zodFieldErrors(error: ValidationIssues): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? 'form');
    errors[field] ??= issue.message;
  }
  return errors;
}

/**
 * Where to send someone after signing in. Only same-site paths are allowed, so
 * a crafted `//evil.example` can never turn sign-in into an open redirect.
 */
export function safeRedirect(target: unknown, fallback = '/account'): string {
  return typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')
    ? target
    : fallback;
}
