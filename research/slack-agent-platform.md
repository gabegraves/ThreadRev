# Slack agent platform research (2026-09-12)

Sources: official Slack docs (docs.slack.dev, api.slack.com, slack.com/help) and official slackapi / slack-samples repos only.
Labels: [V] verified against a fetched official page or executed probe. [U] not verified.

## Summary

1. A bot in a channel receives every message there via `message.channels` (`channels:history`) and `message.groups` (`groups:history`) with no @mention. Thread replies arrive as normal message events carrying `thread_ts`. Edits arrive as `subtype: message_changed`. The bot must be a member of the channel.
2. Socket Mode needs an app-level `xapp-` token, no public URL, up to 10 connections. It is the right transport for a laptop demo. It is not allowed for Marketplace apps, which does not matter here.
3. Agents & AI Apps adds a DM-side assistant pane (status, suggested prompts, titles). It needs `assistant:write`, `chat:write`, `im:history` and the `assistant_thread_started`, `assistant_thread_context_changed`, `message.im` events. The official assistant templates also subscribe to `app_mention` and request `channels:history`, so it coexists with channel monitoring.
4. `files:read` plus `files.info` gives `url_private_download`. Download it with `Authorization: Bearer <xoxb token>`. Canvas content read is not verified [U].
5. `chat.postMessage` with `thread_ts` posts in-thread. `chat.update` rewrites your own bot message (blocks included). Limit: 1 message/sec/channel, 50 blocks/message.
6. Bolt for JS 5.1.0 (Node >=20) and Bolt for Python 1.30.0 (Python >=3.7). Slack has an official hosted MCP server at `https://mcp.slack.com/mcp`.
7. Create the app by pasting a JSON manifest at api.slack.com/apps. By default any member can install to a workspace without admin approval unless "Approve apps" is on. Minimal manifest is in section 7.

## 1. Proactive behavior: receiving every channel message

- `message.channels`: "A message was posted to a channel". Required scope `channels:history`. `channel_type` is `"channel"`. "To receive only messages sent to your app, subscribe to app_mention events instead." [V] https://docs.slack.dev/reference/events/message.channels
- `message.groups`: "A message was posted to a private channel". Scope `groups:history`, `channel_type` `"group"`. [V] https://docs.slack.dev/reference/events/message.groups
- `channels:history` scope: "View messages and other content in public channels that your Slack app has been added to." Enables `conversations.history`, `conversations.replies`, and events `message`, `message.channels`, `message_changed`, `message_deleted`, `message_replied`, `thread_broadcast`. [V] https://docs.slack.dev/reference/scopes/channels.history
- Membership constraint: Events API delivers "events related to channels and direct messages they are party to." The bot must be invited to (or join via `channels:join`) each channel. [V] https://docs.slack.dev/apis/events-api/
- `app_mention`: scope `app_mentions:read`. "If your app is mentioned but not part of a conversation (and not invited to join), you won't receive an event." It "is not a message like the message.* event types." DMs are not dispatched via `app_mention`; use `message.im`. [V] https://docs.slack.dev/reference/events/app_mention
- Thread replies: `message_replied` "is missing the subtype field when dispatched over the Events API." Guidance: "examine message events' thread_ts value. When present, it's a reply." So replies arrive as ordinary `message` events with `thread_ts` set. [V] https://docs.slack.dev/reference/events/message/message_replied
- Edits: "A message_changed message is sent when a message in a channel is edited using the chat.update API method. The message property contains the updated message object." Also fires on user edits and sometimes on automatic language detection. [V] https://docs.slack.dev/reference/events/message/message_changed
- Other subtypes on the same subscription: `message_deleted`, `file_share`, `thread_broadcast`. [V] https://docs.slack.dev/reference/events/message
- Bolt JS `app.message()` filters by subtype; the docs example checks `message.subtype === undefined || 'bot_message' || 'file_share' || 'thread_broadcast'`. Use the `subtype()` middleware for `message_changed`. [V] https://docs.slack.dev/tools/bolt-js/concepts/message-listening
- Backfill: `conversations.replies` (scopes `channels:history`, `groups:history`, `im:history`, `mpim:history`; args `channel`, `ts`) returns the thread. Tier 3. [V] https://docs.slack.dev/reference/methods/conversations.replies

## 2. Transport: Socket Mode vs Events API HTTP

- Socket Mode: "Your app-level token allows your app ... to generate a WebSocket URL ... via the apps.connections.open method." Runs "without exposing a public HTTP Request URL." "Up to 10 open WebSocket connections at the same time." "Your app still needs to acknowledge receiving each event so that Slack knows whether to retry." "Apps using Socket Mode are not currently allowed in the public Slack Marketplace." [V] https://docs.slack.dev/apis/events-api/using-socket-mode
- App-level token: "App-level token strings begin with xapp-." Generated in app settings > Basic Information. Bot tokens begin with `xoxb-`. [V] https://docs.slack.dev/authentication/tokens
- `apps.connections.open` requires an app-level token, returns a `wss://` URL, Tier 3. [V] https://docs.slack.dev/reference/methods/apps.connections.open
- The app-level token scope name `connections:write` was not quoted on a fetched page. [U] (It is the scope the app settings UI offers when generating the token.)
- HTTP Events API: "Your app should respond to the event request with an HTTP 2xx within three seconds." Retries three times with backoff. Needs a public Request URL. [V] https://docs.slack.dev/apis/events-api/
- Verdict for demo: Socket Mode. No tunnel, no public URL, no signing-secret verification. Bolt handles the ack.

## 3. Agents & AI Apps (assistant features)

- Adds: assistant threads (DM side pane), `setStatus` loading indicators, suggested prompts, thread titles, and an agent entry point. Response loop: "receive input -> reason -> call tools -> stream/render output -> repeat if needed". [V] https://docs.slack.dev/ai/developing-ai-apps
- Scopes: `assistant:write` ("automatically added to your app when you enable the feature") and `chat:write` (add manually). Bolt JS Assistant guide also lists `im:history`. [V] https://docs.slack.dev/ai/developing-ai-apps , https://docs.slack.dev/tools/bolt-js/concepts/using-the-assistant-class
- Events: `assistant_thread_started`, `assistant_thread_context_changed`, `message.im`. Newer agent surface also uses `app_home_opened`, `app_context_changed`, `agent_session_stopped`, `agent_session_title_changed`. [V] https://docs.slack.dev/ai/developing-ai-apps
- `assistant_thread_started`: "No scopes required!" Payload has `assistant_thread.context.channel_id` (the channel the user is viewing) plus the DM `channel_id` and `thread_ts`. [V] https://docs.slack.dev/reference/events/assistant_thread_started
- Methods: `assistant.threads.setStatus` (or `agents.sessions.setStatus`), `assistant.threads.setSuggestedPrompts` (up to 4), `assistant.threads.setTitle` (or `agents.sessions.rename`). [V] https://docs.slack.dev/ai/developing-ai-apps
- Bolt JS: `new Assistant({ threadStarted, userMessage })` then `app.assistant(assistant)`. Utilities `say`, `setTitle`, `setStatus({ status, loading_messages })`, `setSuggestedPrompts`. [V] https://docs.slack.dev/tools/bolt-js/concepts/using-the-assistant-class
- Conflict with channel monitoring: none found. The official `bolt-js-assistant-template` manifest enables `assistant_view` and also requests `channels:history`, `groups:history`, `channels:join`, `app_mentions:read` and subscribes to `app_mention`. [V] https://raw.githubusercontent.com/slack-samples/bolt-js-assistant-template/main/manifest.json
- Constraint: "Workspace guests are not permitted to access apps with the Agents feature enabled." [V] https://docs.slack.dev/ai/developing-ai-apps
- Recommendation: treat the assistant pane as optional polish. The core reviewer works on `message.channels` + in-thread posts without it.

## 4. Reading files and documents

- `files:read`: "View files shared in channels and conversations that your Slack app has been added to". Enables `files.info`, `files.list`. [V] https://docs.slack.dev/reference/scopes/files.read
- `files.info`: bot token with `files:read`; returns `url_private` and `url_private_download`. [V] https://docs.slack.dev/reference/methods/files.info
- Download: fetch `url_private` / `url_private_download` with header `Authorization: Bearer A_VALID_TOKEN` where the token has at least `files:read`. [V] https://docs.slack.dev/reference/objects/file-object
- `file_share` message subtype arrives on the normal message subscription, with the file object embedded. [V] https://docs.slack.dev/reference/events/message
- Canvases: `canvases.sections.lookup` (scope `canvases:read`, bot token OK) returns section IDs only. `canvases.create`, `canvases.edit`, `canvases.access.set` write. [V] https://docs.slack.dev/reference/methods/canvases.sections.lookup
- Whether a bot can download rendered canvas body text (e.g. via `url_private` on the canvas file object) was not confirmed on a fetched page. [U] Do not plan on canvas reading for the demo.
- Bot can only see files in conversations it is a member of (scope wording above). External/linked files (Google Drive links) are not downloadable via `url_private`. [U] on the external-file point.

## 5. Posting: threads, updates, Block Kit, rate limits

- `chat.postMessage` `thread_ts`: "Provide another message's ts value to make this message a reply. Avoid using a reply's ts value; use its parent instead." `reply_broadcast` defaults to false. `text` is the fallback when using `blocks`: "we highly recommended that you include text". "It will generally allow an app to post 1 message per second to a specific channel." [V] https://docs.slack.dev/reference/methods/chat.postMessage
- Rule: reply to a top-level message with `thread_ts = message.ts`; reply inside an existing thread with `thread_ts = message.thread_ts`.
- `chat.update`: scope `chat:write`; args `channel`, `ts`. "Bot users may also update the messages they post." Others return `cant_update_message`. "Rich-text blocks cannot be replaced with non-rich-text blocks." Tier 3. [V] https://docs.slack.dev/reference/methods/chat.update
- Block Kit: "You can include up to 50 blocks in each message." Message blocks: section, header, divider, context, actions, rich_text, plus image, markdown, table and others. [V] https://docs.slack.dev/reference/block-kit/blocks
- Rate limits: tiers 1-4 (1+, 20+, 50+, 100+ per minute). `chat.postMessage`: "one message per second per channel, while also maintaining a workspace-wide limit." 429 returns `Retry-After` seconds. [V] https://docs.slack.dev/apis/web-api/rate-limits
- `conversations.history` / `conversations.replies` 1 req/min, 15 objects limit applies only to commercially distributed unlisted apps. "Any internal customer-built apps will maintain their existing rate limits". Internal apps keep 50+/min. [V] https://docs.slack.dev/changelog/2025/06/03/rate-limits-clarity/ , https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/
- Demo implication: one card per reviewed message is fine. Post the card once, then `chat.update` it to add "superseded" or "invalidated" state instead of posting again.

## 6. Official SDKs and minimal code

- Versions measured via npm/PyPI/GitHub API on 2026-09-12: `@slack/bolt` 5.1.0 (Node >=20, npm >=9.6.4; GitHub release 2026-09-02). `slack-bolt` 1.30.0 (Python >=3.7; GitHub release 2026-07-15). [V] https://github.com/slackapi/bolt-js/releases , https://github.com/slackapi/bolt-python/releases
- Bolt JS Socket Mode [V] https://docs.slack.dev/tools/bolt-js/concepts/socket-mode and https://docs.slack.dev/tools/bolt-js/concepts/message-sending

```javascript
const { App } = require('@slack/bolt');
const app = new App({ token: process.env.SLACK_BOT_TOKEN, appToken: process.env.SLACK_APP_TOKEN, socketMode: true });

app.event('message', async ({ event, say }) => {
  if (event.subtype && event.subtype !== 'file_share' && event.subtype !== 'thread_broadcast') return;
  await say({
    thread_ts: event.thread_ts || event.ts,
    text: 'Change review',                       // fallback
    blocks: [{ type: 'section', text: { type: 'mrkdwn', text: '*Evidence*: ...' } }],
  });
});

app.event('message', async ({ event }) => { if (event.subtype === 'message_changed') { /* re-review event.message */ } });

(async () => { await app.start(); })();
```

- Bolt Python Socket Mode [V] https://docs.slack.dev/tools/bolt-python/concepts/socket-mode and https://docs.slack.dev/tools/bolt-python/concepts/message-sending

```python
import os
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

app = App(token=os.environ["SLACK_BOT_TOKEN"])

@app.event("message")
def on_message(event, say, client):
    if event.get("subtype") == "message_changed":
        return  # re-review event["message"], then client.chat_update(...)
    say(thread_ts=event.get("thread_ts") or event["ts"], text="Change review",
        blocks=[{"type": "section", "text": {"type": "mrkdwn", "text": "*Evidence*: ..."}}])

if __name__ == "__main__":
    SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"]).start()
```

- Bolt Python `AsyncApp` + `AsyncSocketModeHandler` exists for asyncio apps. [V] same socket-mode page.
- Slack MCP server (official, hosted): endpoint `https://mcp.slack.com/mcp`, Streamable HTTP, confidential OAuth 2.0 user tokens. Tools: search messages/files/users/channels, send messages, canvases, lists, file upload. "Only directory-published apps or internal apps may use MCP." "Workspace admins can approve and manage all MCP client integrations." Requires a registered Slack app. [V] https://docs.slack.dev/ai/slack-mcp-server/ , https://github.com/slackapi/slack-mcp-plugin
- MCP is for external MCP clients (Claude, IDEs) acting as a user. It is not the event transport for a bot. Not needed for this build.

## 7. App setup friction and minimal manifest

- Creation: at api.slack.com/apps choose "create an app from a manifest", paste JSON, pick workspace, Create. Programmatic: `apps.manifest.create` with an app configuration access token. [V] https://docs.slack.dev/app-manifests/configuring-apps-with-app-manifests , https://docs.slack.dev/reference/methods/apps.manifest.create
- Admin approval: "by default, members can install them without approval from a Workspace Owner." With "Approve apps" enabled, members can only install pre-approved apps and may request others. Enterprise orgs can restrict at org level. [V] https://slack.com/help/articles/222386767-Manage-app-approval-for-your-workspace , https://slack.com/help/articles/360000281563-Manage-apps-in-an-Enterprise-organization
- Practical: use a fresh free workspace you own for the demo. Zero approval friction.
- After install: invite the bot to the channel (`/invite @bot`) or grant `channels:join` and call `conversations.join`.
- Minimal manifest (fields verified against the manifest reference and the official assistant template). [V] https://docs.slack.dev/reference/app-manifest , https://raw.githubusercontent.com/slack-samples/bolt-js-assistant-template/main/manifest.json

```json
{
  "display_information": { "name": "Change Reviewer" },
  "features": {
    "bot_user": { "display_name": "change-reviewer", "always_online": true },
    "app_home": { "messages_tab_enabled": true, "messages_tab_read_only_enabled": false }
  },
  "oauth_config": {
    "scopes": {
      "bot": ["channels:history", "groups:history", "im:history", "channels:join",
              "chat:write", "files:read", "app_mentions:read"]
    }
  },
  "settings": {
    "event_subscriptions": {
      "bot_events": ["message.channels", "message.groups", "message.im", "app_mention"]
    },
    "interactivity": { "is_enabled": true },
    "socket_mode_enabled": true
  }
}
```

- To add the assistant pane later: add `assistant:write` scope, `features.assistant_view.assistant_description`, and events `assistant_thread_started`, `assistant_thread_context_changed`. [V] template manifest above.
- Then: Basic Information > App-Level Tokens > generate `xapp-` token (Socket Mode). Install to workspace > copy `xoxb-` bot token. Set `SLACK_BOT_TOKEN`, `SLACK_APP_TOKEN`.

## Unverified

- U1: The app-level token scope name `connections:write` (not quoted on any fetched page; the Socket Mode page only says "app-level token").
- U2: Whether a bot can fetch canvas body content via `url_private` on a canvas file object.
- U3: Whether externally hosted files (Google Drive links) are downloadable via `url_private` (expected no).
- U4: `previous_message` field presence on `message_changed` events (not in the doc example; historically present in payloads).
