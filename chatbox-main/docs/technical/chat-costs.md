# Chat cost estimates

Configure rates in Settings → provider → Edit Model → Model pricing. Rates use
USD per million tokens; the optional request fee uses USD per API request.
Cached reads and writes have separate optional rates. Zero means free; an
unknown rate is not treated as zero.

OpenRouter chats automatically load the exact model ID from the public
[OpenRouter model catalog](https://openrouter.ai/docs/api/api-reference/models/list-all-models-and-their-properties).
The catalog is cached in memory for one hour. The latest model rate is saved in
provider settings for offline use. A failed fetch keeps saved rates and is
retried after one minute. Manual rates take priority. The model editor can also
import an exact OpenRouter model ID as a reference price for another provider.
Prices imported for other providers refresh only when explicitly requested.

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

This is an estimate, not an account balance or invoice. Paid search, media,
conditional/long-context pricing, routing premiums and other surcharges are not
included. Background calls such as automatic titles and deleted messages are
excluded from the chat total. The existing monthly token statistics are
unchanged; the per-request cost hook can support later spending reports.
