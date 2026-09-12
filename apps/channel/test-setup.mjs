/**
 * Test-run defaults, kept out of the npm script so the command stays portable.
 *
 * `EVIDENCE_LOG=off node ...` is POSIX-only shell syntax: cmd.exe treats it as
 * a command name, so on Windows the suite failed before Node started and the
 * channel tests silently never ran. Setting it here works on every platform.
 */
process.env.EVIDENCE_LOG ??= "off";

/**
 * The suite must never reach a real workplace.
 *
 * publish_result files a follow-up after a card posts, and the replay cases
 * publish cards — so a suite run with a live AMBIGUOUS_API_KEY in scope would
 * create real tasks in someone's workspace, several per run, silently. Today
 * the test command does not load .env, so this cannot happen; that is a
 * property of one npm script rather than a decision anyone made, and adding
 * --env-file for an unrelated reason would quietly undo it.
 *
 * Unset rather than blanked: fileFollowup checks for a key and reports "no
 * workplace configured", which is the behaviour the tests assert against.
 */
delete process.env.AMBIGUOUS_API_KEY;
