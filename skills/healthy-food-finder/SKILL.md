---
name: healthy-food-finder
description: Finds the top 5 healthiest restaurant dishes near you, personalized to your health data from Betterness MCP
requirements:
  env:
    - BETTERNESS_API_KEY
    - GOOGLE_PLACES_API_KEY
    - ANTHROPIC_API_KEY
---

# Healthy Food Finder

Finds the healthiest restaurant food within walking distance, personalized to the user's real health profile from Betterness.

## What it does

1. Pulls the user's health profile from Betterness MCP (vitals, sleep, activity, body composition, biomarkers, biological age)
2. Finds restaurants within a 20-minute walk using Google Places API
3. Uses Claude to cross-reference personal health needs with likely menu options
4. Returns the top 5 healthiest dishes ranked by a personalized health score

## How to use

When the user asks about healthy food nearby, or what to eat for longevity:

1. Get their current location (ask or use device geolocation)
2. Call the Longevity Fuel API at `POST /api/recommend` with `{ "lat": number, "lng": number }`
3. Present the top 5 recommendations including dish name, restaurant, walking time, health score, and personalized reasoning

## Example prompts

- "What's the healthiest food near me?"
- "Find me a longevity-friendly meal within walking distance"
- "What should I eat right now based on my health data?"
- "I'm hungry — what's the best option for my biomarkers?"
