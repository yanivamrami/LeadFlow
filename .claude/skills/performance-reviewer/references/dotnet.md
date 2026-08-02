# .NET / C# — Performance Checklist

Apply on top of the general review process. EF Core issues are usually the
highest-leverage findings — check the data layer first.

## EF Core — queries

- **N+1 queries** — a query executed per item inside a loop, or lazy-loaded
  navigation accessed in a loop. Sev 1 on any request-path code. Fix: projection
  with `.Select(...)` into a DTO, or `.Include()/.ThenInclude()` for eager load.
- **Missing `AsNoTracking()` on read-only queries** — the change tracker retains
  and diffs entities needlessly. Sev 2. Fix: `.AsNoTracking()` for read paths.
- **Unbounded queries** — `.ToListAsync()` with no `Where`/pagination pulling
  whole tables. Sev 1/2 by table size. Fix: filter + `.Skip().Take()` / keyset
  pagination.
- **Over-fetching entities then mapping in memory** — selecting full entities to
  use two columns. Fix: project to a DTO in the query so SQL selects only needed
  columns (reinforces the DTO-at-boundary rule).
- **Client-side evaluation** — LINQ that can't translate runs in memory over the
  full set (watch for custom methods inside `Where`). Fix: keep predicates
  translatable; move logic out of the query or precompute.
- **Missing indexes for query patterns** — filtering/sorting on unindexed
  columns. Flag the column + suggest an index (coordinate with db/CLAUDE.md).
- **`Count()` + then fetch, or `.Any()` misuse** — Fix: `AnyAsync()` for
  existence; avoid materializing to count.
- **Repeated identical queries in one request** — Fix: cache within the unit of
  work, or restructure.
- **Hot-path queries** — consider compiled queries (`EF.CompileAsyncQuery`).

## Async & I/O

- **Sync-over-async** (`.Result`, `.Wait()`, `.GetAwaiter().GetResult()`) — thread
  pool starvation under load. Sev 1/2. Fix: async all the way.
- **Blocking I/O** where async APIs exist (file, network, DB). Fix: async variants.
- **Missing `CancellationToken` plumbing** on long operations. Fix: pass tokens
  from endpoint to query.
- **Sequential awaits that are independent** — Fix: `Task.WhenAll`.

## Allocations & CPU

- Allocations in hot loops (LINQ chains, closures, boxing). Fix: hoist, use spans/
  pooling where it matters, avoid premature LINQ on hot paths.
- **String concatenation in loops** — Fix: `StringBuilder`.
- Large object graphs serialized unnecessarily; big DTOs on hot endpoints.
- Repeated reflection / `JsonSerializer` without cached options.

## Caching

- No caching for expensive, stable computations or reference data. Fix:
  `IMemoryCache` / `HybridCache`, with sane expiry.
- Cache stampede risk on hot keys. Fix: `HybridCache` or locked repopulation.

## API / payload

- Endpoints returning unbounded collections (no pagination). Sev 1/2.
- Oversized payloads (full entities, unused fields) — pairs with DTO findings.
- Missing response compression / streaming for large results
  (`IAsyncEnumerable`).

## Don't overstate
Micro-allocations off the hot path are Sev 3. N+1 and unbounded queries on a
request path are the ones that actually hurt — prioritize those.
