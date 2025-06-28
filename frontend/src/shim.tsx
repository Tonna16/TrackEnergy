// src/shim.ts
import { Buffer } from 'buffer';

// polyfill Buffer
;(window as any).Buffer = Buffer;

// polyfill global (some libs expect it)
if (typeof (window as any).global === 'undefined') {
  ;(window as any).global = window
}
