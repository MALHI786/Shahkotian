/**
 * AdManager — centralises interstitial + app-open ad logic.
 * Banner ads live in <AdBanner /> component; this module handles full-screen ads.
 *
 * Expo Go:  All calls are safe no-ops (native modules are unavailable).
 * EAS Build: Full Google AdMob integration.
 */
import { Platform, AppState } from 'react-native';
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

// ── Test Ad Unit IDs (safe during development) ─────────────────────────────
const TEST_INTERSTITIAL_ANDROID = 'ca-app-pub-3940256099942544/1033173712';
const TEST_INTERSTITIAL_IOS     = 'ca-app-pub-3940256099942544/4411468910';
const TEST_APP_OPEN_ANDROID     = 'ca-app-pub-3940256099942544/9257395921';
const TEST_APP_OPEN_IOS         = 'ca-app-pub-3940256099942544/5575463023';

// ── Real production ad unit IDs ─────────────────────────────────────────────
export const USE_TEST_IDS = false;

export const REAL_INTERSTITIAL_ANDROID = 'ca-app-pub-9583068113931056/6196360069';
export const REAL_INTERSTITIAL_IOS     = 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'; // not used yet
export const REAL_APP_OPEN_ANDROID     = 'ca-app-pub-9583068113931056/8766683089';
export const REAL_APP_OPEN_IOS         = 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'; // not used yet

const INTERSTITIAL_ID = Platform.select({
  android: USE_TEST_IDS ? TEST_INTERSTITIAL_ANDROID : REAL_INTERSTITIAL_ANDROID,
  ios:     USE_TEST_IDS ? TEST_INTERSTITIAL_IOS     : REAL_INTERSTITIAL_IOS,
  default: TEST_INTERSTITIAL_ANDROID,
});

const APP_OPEN_ID = Platform.select({
  android: USE_TEST_IDS ? TEST_APP_OPEN_ANDROID : REAL_APP_OPEN_ANDROID,
  ios:     USE_TEST_IDS ? TEST_APP_OPEN_IOS     : REAL_APP_OPEN_IOS,
  default: TEST_APP_OPEN_ANDROID,
});

// ── Frequency caps ──────────────────────────────────────────────────────────
const MIN_INTERSTITIAL_GAP_MS = 120_000; // max 1 interstitial per 2 min
const MIN_APP_OPEN_GAP_MS     = 180_000; // max 1 app-open ad per 3 min

let lastInterstitialTime = 0;
let lastAppOpenTime      = 0;
let screenViewCount       = 0;

// ── Lazy-loaded SDK references ──────────────────────────────────────────────
let InterstitialAd  = null;
let AdEventType     = null;
let AppOpenAd       = null;
let AdEvent         = null;
let interstitialRef = null;
let appOpenRef      = null;

function loadSdk() {
  if (isExpoGo) return false;
  try {
    const admob = require('react-native-google-mobile-ads');
    InterstitialAd = admob.InterstitialAd;
    AdEventType    = admob.AdEventType;
    AppOpenAd      = admob.AppOpenAd;
    AdEvent        = admob.AdEventType;
    return true;
  } catch {
    return false;
  }
}

// ── Interstitial Ad ─────────────────────────────────────────────────────────

function preloadInterstitial() {
  if (!InterstitialAd) return;
  try {
    interstitialRef = InterstitialAd.createForAdRequest(INTERSTITIAL_ID, {
      requestNonPersonalizedAdsOnly: false,
    });
    interstitialRef.load();
  } catch (e) {
    console.log('Interstitial preload error:', e.message);
  }
}

/**
 * Call this on screen transitions.  Shows an interstitial once every 2 minutes.
 */
export function onScreenView() {
  screenViewCount += 1;
  const now = Date.now();
  if (now - lastInterstitialTime < MIN_INTERSTITIAL_GAP_MS) return; // respect 2-min gap

  if (!interstitialRef) { preloadInterstitial(); return; }

  try {
    interstitialRef.addAdEventListener(AdEventType.CLOSED, () => {
      lastInterstitialTime = Date.now();
      preloadInterstitial(); // preload next
    });
    interstitialRef.show();
  } catch {
    preloadInterstitial();
  }
}

// ── App Open Ad (shown when user returns to app from background) ────────────

function preloadAppOpen() {
  if (!AppOpenAd) return;
  try {
    appOpenRef = AppOpenAd.createForAdRequest(APP_OPEN_ID, {
      requestNonPersonalizedAdsOnly: false,
    });
    appOpenRef.load();
  } catch (e) {
    console.log('AppOpen preload error:', e.message);
  }
}

function handleAppStateChange(nextState) {
  if (nextState !== 'active') return;
  const now = Date.now();
  if (now - lastAppOpenTime < MIN_APP_OPEN_GAP_MS) return;
  if (!appOpenRef) { preloadAppOpen(); return; }
  try {
    appOpenRef.addAdEventListener(AdEventType.CLOSED, () => {
      lastAppOpenTime = Date.now();
      preloadAppOpen();
    });
    appOpenRef.show();
  } catch {
    preloadAppOpen();
  }
}

// ── Initialise ──────────────────────────────────────────────────────────────

let initialised = false;

export function initAds() {
  if (initialised) return;
  initialised = true;
  if (!loadSdk()) {
    console.log('AdManager: running in Expo Go — ads disabled');
    return;
  }
  preloadInterstitial();
  preloadAppOpen();
  // Listen for app returning from background
  AppState.addEventListener('change', handleAppStateChange);
}
