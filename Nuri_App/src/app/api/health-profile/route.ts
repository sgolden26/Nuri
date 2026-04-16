import { NextResponse } from "next/server";
import { getHealthProfile } from "@/lib/betterness";

export async function GET() {
  try {
    const healthProfile = await getHealthProfile();
    return NextResponse.json(healthProfile);
  } catch (error) {
    console.error("Health profile error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 },
    );
  }
}
