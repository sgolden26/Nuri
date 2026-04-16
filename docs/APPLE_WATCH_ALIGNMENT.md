# Apple Watch Data Alignment

This document maps Apple Watch / Health app data to Longevity Eats features and lists user-input items for UX.

## Apple Watch Data Sources (HealthKit / Health app)

| Apple Watch / Health Feature | Data Available | Our User State Field | Notes |
|------------------------------|----------------|----------------------|-------|
| **Hypertension Notifications** | PPG-based 30-day analysis; notifies if signs detected. BP values from user logging (cuff) after notification. | `possibleHypertensionFlag`, `homeBPStage` | Apple Watch Series 9+ / Ultra 2+. Does not measure BP directly. User logs BP in Health app; we read `bloodPressureSystolic` / `bloodPressureDiastolic` via HealthKit. Thresholds: Normal &lt;120/80, Elevated 120–&lt;130/80, Stage 1 130–&lt;135 or 80–85, Stage 2 ≥135 or ≥85 (AHA home BP guidelines). |
| **AFib History / Irregular Rhythm** | AFib frequency over time; IRNF notifications (5/6 irregular tachograms). | `afibHistoryOn`, `recentIrregularRhythmNotification` | AFib History tracks % time in AFib. IRNF = Irregular Rhythm Notification Feature. Alcohol is a known AFib trigger → we restrict alcohol when `afibHistoryOn`. |
| **Sleep (Vitals app)** | Sleep duration, overnight HR, respiratory rate, wrist temperature. Notifications if outside typical range. | `sleepDurationDelta`, `overnightVitalsOutlierCount` | `sleepDurationDelta` = hours vs 7h baseline. Outlier count from Vitals notifications. |
| **Resting heart rate** | From sleep/wake HR samples. | `restingHrDeltaFromBaseline` | Delta from user baseline (e.g. 60 bpm). |
| **Activity / Training** | Heart rate zones, training load, workouts, active calories. | `recentTrainingLoad`, `estimatedVo2Class` | VO2 max: 14–60 ml/kg/min from outdoor walks/runs. Low cardio fitness: lowest quintile (20–59) or 18/15 ml/kg/min (males/females 60+). |
| **Cycle Tracking** | Period, symptoms (cramps), ovulation estimates, cycle deviation. Pregnancy: gestational age, mental health reminders. | `cyclePhase`, `crampsLogged`, `pregnancyOrNursing` | Cycle phase: follicular, ovulation, luteal, menstrual. Symptoms include cramps. Pregnancy inferred from Cycle Tracking pregnancy mode. |
| **Mental health assessments** | GAD-7 (anxiety), PHQ-9 (depression) via Health app. Clinically validated. | `gad7Bucket`, `phq9Bucket` | Buckets: minimal, mild, moderate, (moderately_severe), severe. Used for anxiety/depression dish tags (omega-3, magnesium, tryptophan; evening caffeine restriction). |
| **Current time** | Device time. | `isMorning`, `isLunch`, `isEvening` | 6–11 morning, 11–15 lunch, 16+ evening. |

---

## User-Input Features (for UX)

These cannot be measured by Apple Watch. Keep in API and implement as UX later:

| Feature | Field | Use Case |
|---------|-------|----------|
| **Allergies** | `userAllergens` | Hard exclusion. Essential for safety. |
| **Caffeine trigger** | `caffeineTriggerSelfReported` | User reports caffeine worsens anxiety/palpitations. Complements GAD-7 for evening caffeine restriction. |
| **Alcohol trigger** | `alcoholTriggerSelfReported` | User reports alcohol triggers symptoms (beyond AFib). Complements `afibHistoryOn`. |
| **Pregnancy/nursing** | `pregnancyOrNursing` | Cycle Tracking can indicate pregnancy; user confirmation improves accuracy. Restricts raw fish, high mercury, alcohol. |
| **Dietary goal** | `dietaryGoal` | weight_loss, muscle_gain, maintenance, none. Boosts protein for muscle_gain; penalizes calories/portion for weight_loss. |
| **Tyramine-sensitive (MAOIs)** | `tyramineSensitive` | Avoid aged cheese, cured meats, fermented foods. |
| **Vitamin K–sensitive (warfarin)** | `vitaminKSensitive` | Avoid very high vitamin K (multiple leafy greens). |
| **Ingredient blacklist** | `userBlacklist` | User excludes specific ingredients (e.g. "gluten", "dairy"). |

---

## Evidence-Based Dish Tags (from research)

- **Anxiety**: Omega-3 (fatty fish), magnesium (leafy greens, seeds), tryptophan (turkey, eggs), zinc. Avoid evening caffeine when GAD-7 moderate/severe.
- **Depression**: Same nutrients; PHQ-9 buckets drive `depression_supportive` / `depression_adverse` tags.
- **Cramps**: Magnesium, calcium, omega-3. Avoid heavy/greasy (digestibility). Cycle Tracking symptoms → `crampsLogged`.
- **Hypertension**: Low sodium (top decile excluded), potassium, DASH-style. Hypertension Notification or logged BP.
- **AFib**: No alcohol; heart-healthy diet. AFib History.
- **Sleep**: Low evening caffeine; sleep-supportive foods. Uses `isEvening` + mental health buckets.

---

## Thresholds (from Apple PDFs)

### Blood pressure (AHA home BP, 2017 ACC/AHA)

| Stage | Systolic | Diastolic |
|-------|----------|-----------|
| Normal | &lt;120 | AND &lt;80 |
| Elevated | 120 to &lt;130 | AND &lt;80 |
| Stage 1 | 130 to &lt;135 | OR 80 to &lt;85 |
| Stage 2 | ≥135 | OR ≥85 |
| Crisis | ≥180 | — |

### VO2 max (Apple Cardio Fitness)

- Range: 14–60 ml/kg/min
- Low notification (20–59): lowest quintile by age/sex (FRIEND registry)
- Low notification (60+): 18 ml/kg/min (males), 15 ml/kg/min (females)

### Hypertension Notification

- Not for use during pregnancy
- Requires 30 days of PPG data
- 12+ hours wear per day

---

## UX Features to Add (User Input)

Implement these as settings/onboarding screens when building the frontend:

1. **Allergies** — Multi-select of common allergens (nuts, shellfish, dairy, gluten, etc.). Required for safety.
2. **Caffeine sensitivity** — Toggle: "Caffeine worsens my anxiety or sleep." Used for evening caffeine restriction.
3. **Alcohol sensitivity** — Toggle: "Alcohol triggers my symptoms." Complements AFib (watch provides AFib status).
4. **Pregnancy / nursing** — Toggle. Cycle Tracking can indicate pregnancy; user confirmation improves accuracy.
5. **Dietary goal** — Select: Weight loss | Muscle gain | Maintenance | None.
6. **Medication sensitivities** — Tyramine (MAOIs), Vitamin K (warfarin). Optional toggles.
7. **Ingredient blacklist** — Free-text list of ingredients to exclude (e.g. "gluten", "soy").
