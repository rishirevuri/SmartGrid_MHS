import { NextRequest, NextResponse } from "next/server";
import { answerCopilot } from "@/lib/server/copilot";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const query = String(body.message || body.query || "");
    const context = body.context && typeof body.context === "object" ? body.context : {};
    return NextResponse.json(await answerCopilot(query, context));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to answer copilot query" },
      { status: 500 }
    );
  }
}
