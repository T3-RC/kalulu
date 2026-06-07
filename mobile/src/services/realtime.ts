// Back-compat shim: the SpacetimeDB client is now vendored under src/spacetime/.
// Import from there directly; this file just re-exports for older imports.
export * from "../spacetime/connect";
