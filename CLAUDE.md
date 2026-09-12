# ThreadRev

@AGENTS.md

Read `AGENTS.md` in full, then `STATUS.md`, before editing anything. Find your lane in the "Who is working on what" table and stay inside its directories.

Every task ends with:

1. `npm run verify` passing, or a note saying which narrower command you ran and why.
2. `git add <explicit paths>` for your lane's files only.
3. `git pull --rebase origin main && git push origin main`.
4. Your line in `STATUS.md` updated.

Never commit `.env` or secrets. No co-author trailers. Do not edit another lane's files; write the request to the owner instead.
