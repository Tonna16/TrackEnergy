// src/shim.ts

// This will run before your app and provide a global Buffer
import { Buffer } from 'buffer';
;(window as any).Buffer = Buffer;
