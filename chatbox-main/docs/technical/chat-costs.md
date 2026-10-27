# Chat cost estimates

Configure rates in Settings → provider → Edit Model → Model pricing. Rates use
USD per million tokens; the optional request fee uses USD per API request.
Cached reads and writes have separate optional rates. Zero means free; an
unknown rate is not treated as zero.

Automatic pricing loads rates from the public
[OpenRouter model catalog](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties).
The catalog is cached in memory for one hour. The latest model rate is saved in
provider settings for offline use. A failed fetch keeps saved rates and is
retried after one minute. Manual rates take priority.

Settings → Spending Statistics has an automatic-lookup checkbox (enabled by
default) and a Find and update prices button. Automatic lookup checks connected
chat models at startup, after model-list/authentication changes, on focus and
hourly. One cached catalog serves the whole batch; the explicit button forces a
catalog refresh and also works with automatic lookup disabled. Ollama, LM Studio
and subscription-based Chatbox AI are excluded from automatic reference pricing.

Native provider IDs remain unchanged. For example, Google `gemini-3.8-flash` is
matched to the catalog ID `google/gemini-3.8-flash`; a Google `models/` prefix is
also handled. Anthropic version punctuation and dated native IDs are normalized
only within Anthropic's catalog namespace. Other aliases need a unique exact
basename, or an explicit catalog ID in the model editor. Ambiguous names, missing
versions and free/paid variants are never merged by fuzzy similarity. The model
editor displays the resolved catalog ID separately from the API model ID.

Rates fetched for direct Google, OpenAI and other providers are OpenRouter
reference estimates, not a guarantee of the provider's own invoice. Failed or
unmatched lookups keep saved rates. Removed models are not reinserted, concurrent
manual edits take priority, and existing chat cost snapshots are never repriced.

Each completed API step produces a `UsageRecord.cost` with token counts, USD
estimate, provider/model identity, timestamp and a copy of the tariff. Chat
generation saves these records as `Message.costs`, including tool-call steps
completed before cancellation or an error. Reasoning is already included in
normalized output tokens and is not billed twice. For a single request, missing
token counts can use local estimates marked `usageEstimated`.

The response footer opens request details. The chat header sums saved replies,
threads and regenerated branches, deduplicating message IDs. Direct retries
preserve replaced costs in `Message.previousCosts`. Historical messages without
cost records and steps missing prices are marked incomplete. Old messages are
not repriced using today's rates.

The chat cost popover has a Restart cost counting button. It saves a
`Session.costResetAt` timestamp and starts the chat total from zero, including
copied conversations. Only request costs newer than that timestamp contribute
to the total, across threads and regenerated replies. Individual reply cost
records and monthly spending statistics are retained. The zero total remains
visible after a reset, along with the new counting start time.

This is an estimate, not an account balance or invoice. Paid search, media,
conditional/long-context pricing, routing premiums and other surcharges are not
included. Background calls such as automatic titles and deleted messages are
excluded from the chat total. The existing monthly token statistics are
unchanged.

## Spending statistics

Settings → Spending Statistics (`/settings/costs`) has a coin icon, monthly totals,
a daily chart, and a searchable chat list sorted by recorded cost. Existing chats
open from the list. Deleted chats retain their last recorded name and spending
but cannot be opened. Unassigned background requests have a separate row.

The `spending-stats` storage entry keeps independent monthly aggregates. Only the
current and previous calendar months are retained. A month expires as a whole,
including its daily totals and chat rows, on startup, resume, the calendar
boundary, or the next recorded request. Original conversations are not deleted.

Saved reply costs are imported once using their original timestamps and prices,
including retries and alternate branches. Live requests recorded after tracking
started are excluded from the import to prevent double-counting. Missing prices
remain unknown, and the UI marks incomplete totals. The per-chat session data is
attached by chat orchestration; service calls without a session are unassigned.
