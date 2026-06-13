import { NextResponse } from "next/server";
import { attachNeighbors } from "@/lib/server/gridModel";
import { getGridEdges, getGridNodes } from "@/lib/server/jsonData";

export async function GET() {
  try {
    const [nodes, edges] = await Promise.all([getGridNodes(), getGridEdges()]);
    return NextResponse.json(attachNeighbors(nodes, edges));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load grid nodes" },
      { status: 503 }
    );
  }
}
