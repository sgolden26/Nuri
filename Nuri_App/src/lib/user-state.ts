/**
 * User state vectors — derived from Apple Watch / Health app and optional user input.
 * Apple Watch: hypertension, AFib, sleep, activity/VO2, cycle, mental health (GAD-7, PHQ-9).
 * User input: allergies, caffeine/alcohol triggers, pregnancy, dietary goals, medication sensitivities.
 * See docs/APPLE_WATCH_ALIGNMENT.md for data mapping.
 */

import type { HealthProfile } from "./types";

export type HomeBPStage = "normal" | "elevated" | "stage1" | "stage2" | "crisis" | "unknown";
export type VO2Class = "poor" | "fair" | "average" | "good" | "excellent" | "unknown";
export type GAD7Bucket = "minimal" | "mild" | "moderate" | "severe" | "unknown";
export type PHQ9Bucket = "minimal" | "mild" | "moderate" | "moderately_severe" | "severe" | "unknown";
export type CyclePhase = "follicular" | "ovulation" | "luteal" | "menstrual" | "unknown" | null;

export interface UserState {
  // Apple Watch: Hypertension Notification or logged BP
  possibleHypertensionFlag: boolean;
  homeBPStage: HomeBPStage;

  // Apple Watch: AFib History, Irregular Rhythm Notification
  afibHistoryOn: boolean;
  recentIrregularRhythmNotification: boolean;

  // Apple Watch: Sleep / Vitals
  restingHrDeltaFromBaseline: number;
  sleepDurationDelta: number;
  overnightVitalsOutlierCount: number;

  // Apple Watch: Activity, Cardio Fitness (VO2 max)
  recentTrainingLoad: number;
  estimatedVo2Class: VO2Class;

  // Apple Watch: Cycle Tracking (phase, symptoms, pregnancy)
  cyclePhase: CyclePhase;
  crampsLogged: boolean;
  pregnancyOrNursing: boolean;

  // Apple Watch: Mental health assessments (GAD-7, PHQ-9)
  gad7Bucket: GAD7Bucket;
  phq9Bucket: PHQ9Bucket;

  // User input: triggers (not measurable by watch)
  caffeineTriggerSelfReported: boolean;
  alcoholTriggerSelfReported: boolean;

  // User input: allergies (hard exclusion)
  userAllergens: string[];

  // Device: current hour
  isEvening: boolean;
  isMorning: boolean;
  isLunch: boolean;

  // User input: dietary goals
  dietaryGoal: "weight_loss" | "muscle_gain" | "maintenance" | "none";

  // User input: medication sensitivities (MAOIs, warfarin)
  tyramineSensitive: boolean;
  vitaminKSensitive: boolean;

  // User input: ingredient blacklist
  userBlacklist: string[];
}

const DEFAULT_STATE: UserState = {
  possibleHypertensionFlag: false,
  homeBPStage: "unknown",
  afibHistoryOn: false,
  recentIrregularRhythmNotification: false,
  restingHrDeltaFromBaseline: 0,
  sleepDurationDelta: 0,
  overnightVitalsOutlierCount: 0,
  recentTrainingLoad: 0,
  estimatedVo2Class: "unknown",
  cyclePhase: null,
  crampsLogged: false,
  gad7Bucket: "unknown",
  phq9Bucket: "unknown",
  caffeineTriggerSelfReported: false,
  alcoholTriggerSelfReported: false,
  userAllergens: [],
  isEvening: false,
  isMorning: false,
  isLunch: false,
  pregnancyOrNursing: false,
  dietaryGoal: "none",
  tyramineSensitive: false,
  vitaminKSensitive: false,
  userBlacklist: [],
};

/**
 * Extract BP stage from vitals (AHA 2017 home BP guidelines).
 * Aligns with Apple Hypertension Notification categories.
 */
function inferBPStage(profile: HealthProfile): HomeBPStage {
  const bp = profile.vitals as { bloodPressure?: { systolic?: number; diastolic?: number } } | undefined;
  const sys = bp?.bloodPressure?.systolic;
  const dia = bp?.bloodPressure?.diastolic;
  if (sys == null && dia == null) return "unknown";
  if (sys != null && sys >= 180) return "crisis";
  if ((sys != null && sys >= 135) || (dia != null && dia >= 85)) return "stage2";
  if ((sys != null && sys >= 130) || (dia != null && dia >= 80)) return "stage1";
  if (sys != null && sys >= 120 && (dia == null || dia < 80)) return "elevated";
  return "normal";
}

/** Infer possible hypertension from BP or biomarkers */
function inferHypertension(profile: HealthProfile): boolean {
  const stage = inferBPStage(profile);
  return stage === "elevated" || stage === "stage1" || stage === "stage2" || stage === "crisis";
}

/**
 * Map VO2 max to class (ml/kg/min).
 * Apple Watch range 14–60; low cardio fitness: lowest quintile (20–59) or 18/15 (males/females 60+).
 */
function inferVO2Class(profile: HealthProfile): VO2Class {
  const vo2 = profile.activity as { vo2Max?: number } | undefined;
  const v = vo2?.vo2Max;
  if (v == null) return "unknown";
  if (v >= 50) return "excellent";
  if (v >= 42) return "good";
  if (v >= 35) return "average";
  if (v >= 28) return "fair";
  return "poor";
}

/** Infer resting HR delta (placeholder — would need baseline from history) */
function inferRestingHrDelta(profile: HealthProfile): number {
  const vitals = profile.vitals as { restingHeartRate?: number } | undefined;
  const hr = vitals?.restingHeartRate;
  if (hr == null) return 0;
  // Assume baseline ~60; positive = elevated
  return hr - 60;
}

/** Infer sleep duration delta (placeholder — would need baseline) */
function inferSleepDelta(profile: HealthProfile): number {
  const sleep = profile.sleep as { averageDuration?: string } | undefined;
  const dur = sleep?.averageDuration;
  if (!dur) return 0;
  const match = dur.match(/(\d+)\s*h(?:ours?)?\s*(\d+)?\s*m(?:in)?/i) ?? dur.match(/(\d+)/);
  if (!match) return 0;
  const h = parseInt(match[1], 10) || 0;
  const m = (parseInt(match[2], 10) || 0) / 60;
  const total = h + m;
  return total - 7; // 7h baseline
}

export interface UserStateInput {
  profile: HealthProfile;
  /** User's known allergens for hard exclusion */
  userAllergens?: string[];
  /** Override or supplement from wearables / EHR */
  afibHistoryOn?: boolean;
  recentIrregularRhythmNotification?: boolean;
  overnightVitalsOutlierCount?: number;
  recentTrainingLoad?: number;
  cyclePhase?: CyclePhase;
  crampsLogged?: boolean;
  gad7Bucket?: GAD7Bucket;
  phq9Bucket?: PHQ9Bucket;
  caffeineTriggerSelfReported?: boolean;
  alcoholTriggerSelfReported?: boolean;
  /** Current hour (0–23) for meal period */
  currentHour?: number;
  pregnancyOrNursing?: boolean;
  dietaryGoal?: "weight_loss" | "muscle_gain" | "maintenance" | "none";
  tyramineSensitive?: boolean;
  vitaminKSensitive?: boolean;
  userBlacklist?: string[];
}

/**
 * Build user state from HealthProfile and optional overrides.
 * Call whenever new data arrives — state updates incrementally.
 */
export function buildUserState(input: UserStateInput): UserState {
  const { profile } = input;
  const state: UserState = {
    ...DEFAULT_STATE,
    possibleHypertensionFlag: inferHypertension(profile),
    homeBPStage: inferBPStage(profile),
    restingHrDeltaFromBaseline: inferRestingHrDelta(profile),
    sleepDurationDelta: inferSleepDelta(profile),
    estimatedVo2Class: inferVO2Class(profile),
    userAllergens: input.userAllergens ?? [],
    userBlacklist: input.userBlacklist ?? [],
  };

  const hour = input.currentHour ?? new Date().getHours();
  state.isMorning = hour >= 6 && hour < 11;
  state.isLunch = hour >= 11 && hour < 15;
  state.isEvening = hour >= 16;

  if (input.pregnancyOrNursing != null) state.pregnancyOrNursing = input.pregnancyOrNursing;
  if (input.dietaryGoal != null) state.dietaryGoal = input.dietaryGoal;
  if (input.tyramineSensitive != null) state.tyramineSensitive = input.tyramineSensitive;
  if (input.vitaminKSensitive != null) state.vitaminKSensitive = input.vitaminKSensitive;

  if (input.afibHistoryOn != null) state.afibHistoryOn = input.afibHistoryOn;
  if (input.recentIrregularRhythmNotification != null)
    state.recentIrregularRhythmNotification = input.recentIrregularRhythmNotification;
  if (input.overnightVitalsOutlierCount != null)
    state.overnightVitalsOutlierCount = input.overnightVitalsOutlierCount;
  if (input.recentTrainingLoad != null) state.recentTrainingLoad = input.recentTrainingLoad;
  if (input.cyclePhase != null) state.cyclePhase = input.cyclePhase;
  if (input.crampsLogged != null) state.crampsLogged = input.crampsLogged;
  if (input.gad7Bucket != null) state.gad7Bucket = input.gad7Bucket;
  if (input.phq9Bucket != null) state.phq9Bucket = input.phq9Bucket;
  if (input.caffeineTriggerSelfReported != null)
    state.caffeineTriggerSelfReported = input.caffeineTriggerSelfReported;
  if (input.alcoholTriggerSelfReported != null)
    state.alcoholTriggerSelfReported = input.alcoholTriggerSelfReported;

  return state;
}

export type DietaryGoal = UserState["dietaryGoal"];
