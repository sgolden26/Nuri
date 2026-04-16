import { HealthProfile } from "./types";

const MCP_URL =
  process.env.BETTERNESS_MCP_URL || "https://api.betterness.ai/mcp";
const API_KEY = process.env.BETTERNESS_API_KEY;

function parseSSEBody(
  text: string,
  label: string,
): Record<string, unknown> | null {
  // SSE responses have: id:<session>\nevent:message\ndata:{jsonrpc payload}
  for (const line of text.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const jsonStr = line.slice(5).trim();
    try {
      const rpc = JSON.parse(jsonStr);
      if (rpc.result?.isError) {
        console.warn(`[MCP ${label}] Tool returned error:`, rpc.result);
        return null;
      }
      const content = rpc.result?.content;
      if (Array.isArray(content)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const textBlock = content.find((c: any) => c.type === "text");
        if (textBlock?.text) {
          try {
            const parsed = JSON.parse(textBlock.text);
            if (
              parsed === null ||
              typeof parsed === "string" ||
              (typeof parsed === "object" && Object.keys(parsed).length === 0) ||
              (Array.isArray(parsed) && parsed.length === 0)
            ) {
              console.warn(`[MCP ${label}] Empty/error data returned:`, textBlock.text.slice(0, 100));
              return null;
            }
            return typeof parsed === "object" && !Array.isArray(parsed)
              ? parsed
              : { _data: parsed };
          } catch {
            console.warn(`[MCP ${label}] Non-JSON text:`, textBlock.text.slice(0, 100));
            return null;
          }
        }
      }
      return rpc.result ?? null;
    } catch {
      /* not valid JSON on this line */
    }
  }

  // Fallback: try the whole body as plain JSON
  try {
    const rpc = JSON.parse(text);
    if (rpc.result?.isError) return null;
    return rpc.result ?? null;
  } catch {
    return null;
  }
}

class MCPClient {
  private sessionId: string | null = null;
  private seq = 0;
  private initPromise: Promise<void> | null = null;

  private get headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
    if (this.sessionId) h["Mcp-Session-Id"] = this.sessionId;
    return h;
  }

  private async doInitialize() {
    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "longevity-fuel", version: "1.0.0" },
        },
        id: ++this.seq,
      }),
    });

    this.sessionId = res.headers.get("mcp-session-id");
    const body = await res.text();
    console.log("[MCP] Session:", this.sessionId, "Init status:", res.status);
    parseSSEBody(body, "initialize");

    await fetch(MCP_URL, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });
  }

  private async ensureInitialized() {
    if (this.sessionId) return;
    if (!this.initPromise) {
      this.initPromise = this.doInitialize();
    }
    await this.initPromise;
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<Record<string, unknown> | null> {
    await this.ensureInitialized();

    const res = await fetch(MCP_URL, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "tools/call",
        params: { name, arguments: args },
        id: ++this.seq,
      }),
    });

    const body = await res.text();
    return parseSSEBody(body, name);
  }
}

function isEmpty(profile: HealthProfile): boolean {
  return Object.values(profile).every((v) => v == null);
}

function hasExtractableBiomarkers(obj: Record<string, unknown>): boolean {
  function walk(o: unknown): boolean {
    if (!o || typeof o !== "object") return false;
    const rec = o as Record<string, unknown>;
    if ("value" in rec && ("unit" in rec || "status" in rec)) return true;
    return Object.values(rec).some((v) => typeof v === "object" && walk(v));
  }
  return walk(obj);
}

export async function getHealthProfile(): Promise<HealthProfile> {
  if (!API_KEY) {
    console.warn("BETTERNESS_API_KEY not set — using mock health data");
    return MOCK_PROFILE;
  }

  const client = new MCPClient();

  const [vitals, sleep, activity, bodyComposition, biomarkers, biologicalAge] =
    await Promise.all([
      client.callTool("getVitals").catch(() => null),
      client.callTool("getSleepData").catch(() => null),
      client.callTool("getActivityData").catch(() => null),
      client.callTool("getBodyComposition").catch(() => null),
      client.callTool("searchBiomarkers").catch(() => null),
      client.callTool("getBiologicalAge").catch(() => null),
    ]);

  const profile: HealthProfile = {
    vitals,
    sleep,
    activity,
    bodyComposition,
    biomarkers,
    biologicalAge,
    allergies: MOCK_PROFILE.allergies,
  };

  if (isEmpty(profile)) {
    console.warn(
      "Betterness returned no usable data (no wearable/labs connected) — falling back to demo profile",
    );
    return { ...MOCK_PROFILE, _demo: true } as HealthProfile;
  }

  // Merge mock data for any missing categories so the UI isn't half-empty.
  // For biomarkers, also fall back to mock when the API returns data in an
  // unrecognised shape (extractBiomarkers would yield nothing).
  const usableBiomarkers =
    profile.biomarkers && hasExtractableBiomarkers(profile.biomarkers)
      ? profile.biomarkers
      : MOCK_PROFILE.biomarkers;

  return {
    vitals: profile.vitals ?? MOCK_PROFILE.vitals,
    sleep: profile.sleep ?? MOCK_PROFILE.sleep,
    activity: profile.activity ?? MOCK_PROFILE.activity,
    bodyComposition: profile.bodyComposition ?? MOCK_PROFILE.bodyComposition,
    biomarkers: usableBiomarkers,
    biologicalAge: profile.biologicalAge ?? MOCK_PROFILE.biologicalAge,
    allergies: profile.allergies ?? MOCK_PROFILE.allergies,
  };
}

const MOCK_PROFILE: HealthProfile = {
  vitals: {
    restingHeartRate: 62,
    hrv: 45,
    bloodPressure: { systolic: 118, diastolic: 76 },
    spO2: 98,
  },
  sleep: {
    averageDuration: "6h 42m",
    deepSleep: "1h 10m",
    remSleep: "1h 35m",
    sleepScore: 72,
  },
  activity: {
    steps: 8500,
    vo2Max: 42,
    activeCalories: 420,
    workoutsThisWeek: 3,
  },
  bodyComposition: {
    weight: 175,
    bodyFatPct: 18,
    muscleMass: 140,
    bmi: 24.2,
  },
  biomarkers: {
    vitaminD: { value: 28, unit: "ng/mL", status: "low" },
    glucose: { value: 95, unit: "mg/dL", status: "normal" },
    ldl: { value: 118, unit: "mg/dL", status: "borderline" },
    crp: { value: 1.2, unit: "mg/L", status: "normal" },
    iron: { value: 75, unit: "mcg/dL", status: "normal" },
  },
  biologicalAge: { biologicalAge: 18, chronologicalAge: 22 },
  allergies: null,
};
