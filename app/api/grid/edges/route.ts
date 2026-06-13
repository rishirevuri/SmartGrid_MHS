import { NextResponse } from "next/server";
import { getGridEdges } from "@/lib/server/jsonData";

export async function GET() {
  try {
    return NextResponse.json(await getGridEdges());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load grid edges" },
      { status: 503 }
    );
  }
}
