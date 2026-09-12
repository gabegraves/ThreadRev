export function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      [
        `Missing required environment variable: ${name}.`,
        "",
        "  Add the missing value to the root `.env` file,",
        "  run `npm run channel:setup` to configure Slack or Teams,",
        "  or `npm run dev:web` to try the browser template instead.",
      ].join("\n"),
    );
  }
  return value;
}

/**
 * The first of several names that is set.
 *
 * `copilotkit channels setup` provisions CPK_INTELLIGENCE_API_KEY, the CLI's
 * diagnostics ask for CPK_INTELLIGENCE_API_KEY or COPILOTKIT_API_KEY, and this
 * runtime reads INTELLIGENCE_API_KEY. The starter's own .env.example flags the
 * mismatch and leaves you to map it by hand — which is a step to forget at the
 * exact moment you are least able to afford it, since the failure is a channel
 * that starts, reports online, and answers nothing.
 *
 * Accept any of them and say all of them when none is set.
 */
export function requiredAny(names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  throw new Error(
    [
      `Missing required environment variable: set one of ${names.join(", ")}.`,
      "",
      "  `npm run channel:setup` writes CPK_INTELLIGENCE_API_KEY; any of the",
      "  names above is accepted here, so copy whichever one it gave you into",
      "  the root `.env`.",
    ].join("\n"),
  );
}
