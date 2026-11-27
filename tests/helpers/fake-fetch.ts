// Shared helpers for tests that fake the network. Not a test file.
import { readFileSync } from 'node:fs';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

export const CHICAGO = { latitude: 41.88, longitude: -87.63, timeZone: 'America/Chicago' };

/** A real Response with a JSON body. */
export const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });

/** A fake fetch that records every call and answers with `handler(url, init, callNumber)`. */
export const recorder = (handler) => {
  const calls = [];
  const fetchFunction = async (url, init) => {
    calls.push({ url, init });
    return handler(url, init, calls.length);
  };
  return { fetchFn: fetchFunction, calls };
};

/** A request that never answers but rejects when it is aborted (what a real timeout does). */
export const hang = (url, init) =>
  new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  });

/** The error a promise rejects with, or undefined when it resolves. */
export const failureOf = async (promise) => {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  return undefined;
};
