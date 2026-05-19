# NestJS Setup Issue: Why Consolidation Excel Export Fails Locally

## Current Symptom

On the Procurement Officer consolidation page, clicking `Download .xlsx` can fail with Convex errors such as:

- `PROCURELINE_SERVICE_JWT_SECRET must be configured for Convex-to-NestJS service calls`
- `SERVICE_UNAVAILABLE`
- `fetch failed`
- `CONVEX_SYNC_FAILED`
- `QUEUE_UNAVAILABLE`
- `Redis is unavailable. Retryable work was not accepted.`
- `reportName is required for consolidated Excel export`
- `calculation-mismatch: annualGrandTotal snapshot value ... does not match Excel seed ...`
- `calculation-mismatch: quarterlyTotals.q1 snapshot value 0 does not match Excel seed ...`
- Export reports success or queued, but no browser download starts.

These errors are not caused by the Excel workbook formatter itself. They happen before or during the service bridge call from Convex to NestJS.

## Mental Model

The export path is:

```text
Browser at http://localhost:3000
  -> Next.js UI calls a Convex action
  -> hosted Convex action validates/finalizes export metadata
  -> hosted Convex calls NestJS through NESTJS_URL
  -> NestJS generates or queues the workbook
  -> Redis/BullMQ accepts retryable background work, when async mode is available
  -> Convex records export status/download metadata
```

The important detail is that the Convex action runs in the hosted Convex runtime, not inside the browser and not inside the local Next.js dev server.

## Root Cause

`localhost` means different things depending on where the code runs:

- In the browser, `localhost:3000` means this developer machine.
- In the local NestJS process, `localhost:4001` means this developer machine.
- In hosted Convex, `localhost:4001` means the Convex server, not this developer machine.

So if Convex has:

```text
NESTJS_URL=http://localhost:4001
```

then hosted Convex tries to call port `4001` on its own runtime, where NestJS is not running. That produces `SERVICE_UNAVAILABLE` or `fetch failed`.

The JWT secret error was a separate first-layer configuration problem. Convex also needs the same service JWT secret that NestJS expects so it can sign authenticated service requests.

`CONVEX_SYNC_FAILED` was another separate layer. NestJS does not write directly into the Convex database; after generating work it calls the Convex HTTP sync route. The local NestJS `.env` must use the Convex site URL, not the cloud runtime URL:

```text
CONVEX_URL=https://vibrant-bulldog-86.convex.site
```

Use `.convex.site` for HTTP actions/routes such as `/api/services/sync`. The `.convex.cloud` URL is the Convex deployment runtime URL and does not expose those HTTP routes in the same way.

`QUEUE_UNAVAILABLE` is the fourth layer. NestJS uses BullMQ for retryable background jobs, and BullMQ requires Redis. In this local workspace, `REDIS_URL=redis://localhost:6379`, but no Redis server is listening on port `6379`, so NestJS refuses to accept queue work.

`reportName is required for consolidated Excel export` was a payload-shape bug between Story 7.5 orchestration and Story 7.6 formatting. Convex sent `reportName` on the outer queue DTO, while the NestJS formatter validated the inner workbook payload. The fix is to normalize the queue DTO before formatting and fall back to the outer `reportName` when the inner payload does not carry it.

`calculation-mismatch ... snapshot value 25000 does not match Excel seed 0` was a second payload normalization bug. The finalized source department workspace is stored as a persisted Blockly record where `workspaceJson` is a JSON string. The NestJS adapter was treating it as an object, so it found no department/category/item rows and generated an Excel seed total of `0`. The fix is to parse serialized `workspaceJson` before extracting department rows and to carry the department vote number onto each workbook item row.

`calculation-mismatch: quarterlyTotals.q1 snapshot value 0 does not match Excel seed ...` was a stale snapshot-total issue. Some finalized snapshots stored aggregate quarter fields as `0` even though the embedded source department workspaces still contained the correct item rows and quarter quantities. The export adapter now seeds workbook quarter totals from the parsed source rows, while keeping the annual grand total tied to the finalized aggregate total.

The "queued but no download starts" issue was a delivery-path gap. In the Redis fallback path, NestJS generated the workbook synchronously and marked the Convex export complete, but returned only queue metadata to the browser. The stored `downloadUrl` is a placeholder endpoint and no NestJS download route currently serves the generated workbook from durable storage. For local synchronous fallback, NestJS now returns `workbookBase64` and `fileName` directly to Convex, and the `Download .xlsx` button creates a browser Blob download immediately.

## Temporary Local Development Setup

For local development, NestJS must be made reachable by hosted Convex through a public HTTPS URL.

Current working tunnel setup:

```powershell
ssh -o StrictHostKeyChecking=no -R 80:localhost:4001 nokey@localhost.run
```

The current tunnel URL set in Convex is:

```text
https://f3fd42697f3f8f.lhr.life
```

Convex environment variables were set with:

```powershell
cd C:\Users\Tyroon\Downloads\project\Procureline\webapp
cmd /c npx convex env set NESTJS_URL https://f3fd42697f3f8f.lhr.life
cmd /c npx convex env set PROCURELINE_SERVICE_JWT_SECRET dev-service-jwt-secret
cmd /c npx convex env set PROCURELINE_CONVEX_SYNC_SECRET dev-convex-sync-secret
```

NestJS must also be running locally:

```powershell
cd C:\Users\Tyroon\Downloads\project\Procureline\nestjs
npm run start:dev
```

Check the tunnel reaches NestJS:

```powershell
curl.exe -i https://f3fd42697f3f8f.lhr.life/api/services/docs/openapi.json
```

Expected result: HTTP `200 OK`.

Check Redis:

```powershell
Test-NetConnection -ComputerName 127.0.0.1 -Port 6379
```

Expected result for full queue mode: `TcpTestSucceeded : True`.

For local development only, the consolidated-plan export path now has a guarded fallback: if Redis is unavailable and only the consolidated Excel export cannot be queued, NestJS generates the workbook synchronously and immediately completes the Convex sync event. This lets `Download .xlsx` work without Redis while preserving BullMQ for production and for retryable work when Redis is available.

Current local hardening now covers:

- Missing Redis: consolidated Excel export completes synchronously.
- Missing inner `reportName`: NestJS falls back to the queue DTO report name.
- Serialized Blockly source workspaces: NestJS parses `workspaceJson` strings before building workbook rows.
- Stale zero snapshot quarter totals: NestJS derives workbook quarter seed totals from parsed source item rows.
- Local synchronous fallback download: NestJS returns workbook bytes directly and the browser starts the `.xlsx` download immediately.
- Snapshot mismatch guard: the workbook formatter still rejects exports when parsed rows do not match finalized aggregate totals.

## Why This Temporary Setup Breaks

The tunnel URL is temporary. Export will fail again if:

- the SSH tunnel process stops,
- the machine sleeps,
- the NestJS dev server stops,
- localhost.run rotates or expires the URL,
- Convex still points to an old tunnel URL,
- the service JWT secret differs between Convex and NestJS.
- `PROCURELINE_CONVEX_SYNC_SECRET` differs between Convex and NestJS,
- local NestJS points `CONVEX_URL` at `.convex.cloud` instead of `.convex.site`,
- Redis is unavailable and the request path does not have a local synchronous fallback.

When that happens, create a new tunnel, verify it returns HTTP `200`, then update Convex `NESTJS_URL` again.

## Permanent Fix

Deploy NestJS to a stable public service and stop using a temporary tunnel.

Recommended target:

```text
https://api.procureline.example.com
```

or the platform-generated URL from Railway, Render, Fly.io, Azure, AWS, or another host.

Permanent setup steps:

1. Deploy `nestjs/` as a long-running Node.js service.
2. Configure these environment variables on the deployed NestJS service:

```text
NESTJS_HOST=0.0.0.0
NESTJS_PORT=<platform port or 4001>
NESTJS_URL=https://your-public-nestjs-url
PROCURELINE_SERVICE_JWT_SECRET=<strong shared secret>
PROCURELINE_CONVEX_SYNC_SECRET=<strong shared sync secret>
REDIS_URL=<managed Redis URL>
```

3. Configure hosted Convex with the same reachable URL and same JWT secret:

```powershell
cd C:\Users\Tyroon\Downloads\project\Procureline\webapp
cmd /c npx convex env set NESTJS_URL https://your-public-nestjs-url
cmd /c npx convex env set PROCURELINE_SERVICE_JWT_SECRET <strong shared secret>
cmd /c npx convex env set PROCURELINE_CONVEX_SYNC_SECRET <strong shared sync secret>
```

4. Verify from outside the local machine:

```powershell
curl.exe -i https://your-public-nestjs-url/api/services/docs/openapi.json
```

5. Retry `Download .xlsx` from the consolidation preview modal.

## What Works Now vs What Production Still Needs

The local export now works because the code has two paths:

```text
Normal queued path:
Convex -> NestJS -> Redis/BullMQ -> worker -> Convex completion -> download metadata

Local fallback path:
Convex -> NestJS -> synchronous workbook generation -> Convex completion -> browser receives workbookBase64 -> immediate download
```

The successful local download is currently using the fallback path because Redis is not running locally. That fallback is useful for development, but it should not be confused with a complete production export-storage system.

The workbook formatter and payload-normalization fixes should carry over to production:

- The finalized export payload now includes the report name, institution name, source snapshot metadata, and source department workspaces.
- NestJS parses serialized Blockly `workspaceJson` before extracting workbook rows.
- NestJS derives workbook quarter seed totals from parsed source item rows when finalized quarter totals are stale zeroes.
- The workbook formatter still protects against real total mismatches.

The production delivery path still needs one clear decision:

### Option A: Synchronous Download Now

Use a first-class synchronous consolidated export route for the `Download .xlsx` button.

```text
Browser -> Convex action -> NestJS formatter -> workbookBase64/file response -> browser download
```

This is the simplest fit for the current PO workflow. It avoids Redis and avoids storage for normal "download now" behavior. Export history can still be recorded separately if needed.

### Option B: Queued Export With Durable Storage

Keep the queued production architecture, but complete the missing storage/download layer.

```text
Browser -> Convex action -> NestJS queues job -> Redis/BullMQ worker generates workbook
-> worker stores file in durable storage
-> worker syncs Convex with a real downloadUrl
-> browser/history opens that URL
```

This requires:

- A managed Redis instance configured through `REDIS_URL`.
- Durable file storage for generated workbooks.
- A real download endpoint or signed storage URL.
- Convex export history polling/notification UX that opens the completed export.

Right now, NestJS returns a placeholder URL shaped like:

```text
/api/services/files/exports/consolidated-plan/{exportId}/download
```

That URL is not enough by itself unless a NestJS controller route and storage lookup are implemented for it.

## Production Readiness Checklist

Before expecting production `Download .xlsx` to work reliably, verify:

- `NESTJS_URL` in Convex points to a stable public HTTPS NestJS deployment.
- `PROCURELINE_SERVICE_JWT_SECRET` matches between Convex and NestJS.
- `PROCURELINE_CONVEX_SYNC_SECRET` matches between Convex and NestJS.
- `CONVEX_URL` in NestJS points to the Convex `.site` HTTP URL, not `.convex.cloud`.
- `REDIS_URL` points to reachable Redis if using queued exports.
- The product chooses synchronous download or queued durable-storage download.
- If queued durable-storage download is chosen, implement storage and a real download URL before relying on export history.

## Recommended Permanent Direction

For this specific PO `Download .xlsx` button, the simpler permanent design is:

```text
Download .xlsx -> prepare finalized export payload -> NestJS workbook formatter -> return file immediately
```

Use queues for batch exports, scheduled jobs, emails, retries, or very large exports. Do not make Redis and background storage mandatory for a single user pressing "download now" unless the product explicitly wants asynchronous export history as the primary workflow.

## Local Dev Without Tunnel

The local webapp now has a development-only export route:

```text
POST /api/local/consolidated-plan-export
```

In development, the `Download .xlsx` button uses this route instead of the hosted Convex action.

Local flow:

```text
Browser at localhost:3000
-> Next.js local API route
-> local NestJS at http://127.0.0.1:4001
-> synchronous workbook formatter
-> workbookBase64 returned to browser
-> browser Blob download starts immediately
```

This means local Excel export no longer depends on:

- localhost.run tunnel
- hosted Convex `NESTJS_URL`
- Redis/BullMQ
- Convex export completion sync

For this local route, you still need NestJS running:

```powershell
cd C:\Users\Tyroon\Downloads\project\Procureline\nestjs
npm run build
npm start
```

The webapp dev script now starts NestJS for you:

```powershell
cd C:\Users\Tyroon\Downloads\project\Procureline\webapp
npm run dev
```

That runs these local processes in parallel:

```text
next dev
convex dev --typecheck=disable
cd ../nestjs && npm run start:dev
```

So for normal local development, `npm run dev` from `webapp/` should be enough to bring up the UI, Convex dev, and the local NestJS service used by Excel export. Running NestJS manually is still useful when debugging only the service.

The webapp route calls `LOCAL_NESTJS_URL` first, then defaults to:

```text
http://127.0.0.1:4001
```

It intentionally does not use hosted Convex `NESTJS_URL`, because that setting is for the Convex-to-NestJS bridge and may point at a temporary tunnel.

This route is disabled in production. Production should still use either a stable synchronous service endpoint or the queued durable-storage path described above.

## Local File Env vs Convex Env

These local files are still useful:

- `webapp/.env.local`
- `nestjs/.env`

But they do not automatically configure hosted Convex. The export action reads Convex runtime environment variables, so `npx convex env set ...` is required for the hosted Convex deployment.

## Operational Rule

For reliable exports:

```text
Hosted Convex NESTJS_URL must point to a public HTTPS URL that can reach NestJS.
NestJS CONVEX_URL must point to the Convex .site HTTP routes URL.
NestJS REDIS_URL must point to a reachable Redis instance for background jobs.
```

Never use `http://localhost:4001` for hosted Convex unless Convex is also running locally in the same network context.
