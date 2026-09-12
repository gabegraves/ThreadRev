/**
 * Test-run defaults, kept out of the npm script so the command stays portable.
 *
 * `EVIDENCE_LOG=off node ...` is POSIX-only shell syntax: cmd.exe treats it as
 * a command name, so on Windows the suite failed before Node started and the
 * channel tests silently never ran. Setting it here works on every platform.
 */
process.env.EVIDENCE_LOG ??= "off";
