// SpacetimeDB SDK polyfills for React Native. MUST be imported before anything
// that touches the SDK (see App.js — this is the very first import).
import "react-native-get-random-values"; // crypto.getRandomValues (identity/token)
import { TextEncoder, TextDecoder } from "text-encoding";
import { Buffer } from "buffer";

if (typeof global.TextEncoder === "undefined") {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
  global.TextDecoder = TextDecoder;
}
if (typeof global.Buffer === "undefined") {
  global.Buffer = Buffer;
}
