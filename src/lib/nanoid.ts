import { customAlphabet } from 'nanoid';
import { SLUG_LENGTH } from './config';

// No ambiguous chars (0/O, 1/l/I) — slugs get read aloud and retyped (SPEC §4)
const UNAMBIGUOUS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';

export const nanoid = customAlphabet(UNAMBIGUOUS, SLUG_LENGTH);
