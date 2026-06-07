# Test Results

Run in the sandbox: Rust 1.96.0, `spacetimedb` 1.12.0, Node 22, Python 3.10.

## Summary

| Test | Tool | Result |
|------|------|--------|
| Module compiles to WASM | `cargo build --target wasm32-unknown-unknown` | ✅ pass (`kalulu_module.wasm`, 17 MB) |
| Core logic unit tests | `cargo test` (DBSCAN, neighborhood, haversine, civil-date) | ✅ 5/5 pass |
| Clustering algorithm cross-check | independent Python DBSCAN on the same fixture | ✅ matches Rust (1 cluster of 4, post 99 = noise) |
| TS client + hooks typecheck | `tsc --noEmit` against SDK-shaped stubs | ✅ pass |
| Image worker syntax | `node --check` (ESM) | ✅ pass |
| Deploy script syntax | `bash -n` | ✅ pass |

## Bugs found and fixed during testing

1. **Missing `ctx.db` plural renames in multi-line chains.** The table rename to
   plural names had only updated single-line `ctx.db.post()` calls; chained calls
   spanning lines (`ctx\n.db\n.follow()`) were missed. The compiler flagged 7
   `E0599 no method` errors (`.user/.post/.like/.follow`). Fixed — all accessors now
   plural; rebuild clean.

2. **`Identity::to_hex_string()` does not exist on spacetimedb 1.12.0.** Compiler
   suggested `to_string()`; applied. (This was the exact spot pre-flagged as
   version-sensitive.)

3. **Truncated `lib.rs` (missing final two `}`).** A file-write desync left the
   file two closing braces short, causing an "unclosed delimiter" parse error.
   Appended the braces; brace balance now 0 and the crate parses + compiles.

## Not covered (needs your accounts / a live module)

- `spacetime generate` real bindings + `spacetime publish` to a running instance.
- End-to-end runtime: live subscriptions, reducer round-trips, scheduled clustering
  firing on the 5-minute timer.
- Worker deploy against real R2 + Images; web build against real generated bindings.
- AWS Rekognition moderation (not yet implemented — documented hook point only).

## Reproduce

```bash
# core logic (no external deps)
cd spacetimedb/server && cargo test
# full module to WASM
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown
```
