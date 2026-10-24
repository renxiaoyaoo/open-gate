import { NextResponse } from "next/server";
import { assertCentralEnabled, setDoorSelected } from "@/lib/central";
import { jsonError } from "@/lib/http";

export async function PATCH(request: Request, context: { params: Promise<{ doorKey: string }> }) {
  try {
    assertCentralEnabled();
    const body = await request.json() as { selected?: unknown };
    if (typeof body.selected !== "boolean") throw new Error("选择状态无效");
    await setDoorSelected((await context.params).doorKey, body.selected);
    return NextResponse.json({ ok: true, data: { selected: body.selected } });
  } catch (error) { return jsonError(error); }
}
