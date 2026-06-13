import { NextRequest, NextResponse } from "next/server";
import { getGridEdges, getGridNodes } from "@/lib/server/jsonData";
import { simulateReroute } from "@/lib/server/simulations";
import { rememberLocal } from "@/lib/server/backboard";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const failedNodeId = String(body.failed_node_id || "");
    const [nodes, edges] = await Promise.all([getGridNodes(), getGridEdges()]);
    const result = simulateReroute(nodes, edges, failedNodeId);

    if (!result) {
      return NextResponse.json({ detail: `Node '${failedNodeId}' not found` }, { status: 404 });
    }

    rememberLocal({ type: "reroute_simulation", payload: result });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to simulate reroute" },
      { status: 500 }
    );
  }
}
