/**
 * Geolocation service.
 *  - getFix(): one-shot position for the initial alert.
 *  - watch()/stopWatch(): continuous updates that power live tracking (feature A)
 *    during an active emergency. Emits 'location:update' on the shared bus.
 */
import { TUNING } from '../config.js';

let last = null;
let watchId = null;
let intervalId = null;

export function lastFix() { return last; }

export function mapsUrl(fix = last) {
  return fix ? `https://maps.google.com/?q=${fix.lat.toFixed(5)},${fix.lng.toFixed(5)}` : '';
}

function record(pos) {
  last = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, at: Date.now() };
  return last;
}

/** Resolve with a fix or null (never rejects, so the alert flow can proceed). */
export function getFix() {
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(record(pos)),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: TUNING.geoTimeoutMs, maximumAge: 0 },
    );
  });
}

/**
 * Begin live tracking. Uses watchPosition for OS-pushed updates and a coarse
 * interval as a floor so `onUpdate` fires at least every `everyMs`.
 * @param {(fix:object)=>void} onUpdate
 */
export function watch(onUpdate, everyMs = TUNING.trackIntervalMs) {
  if (!('geolocation' in navigator) || watchId != null) return;
  watchId = navigator.geolocation.watchPosition(
    (pos) => onUpdate(record(pos)),
    () => {},
    { enableHighAccuracy: true, maximumAge: 5_000, timeout: TUNING.geoTimeoutMs },
  );
  intervalId = setInterval(() => { if (last) onUpdate(last); }, everyMs);
}

export function stopWatch() {
  if (watchId != null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  if (intervalId != null) { clearInterval(intervalId); intervalId = null; }
}

export function isTracking() { return watchId != null; }
