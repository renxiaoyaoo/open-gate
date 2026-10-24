import { NextResponse } from "next/server";
import { assertCentralEnabled, moveSelectedDoor } from "@/lib/central";
import { jsonError } from "@/lib/http";
import { setProviderDoorSelected } from "@/lib/provider-service";

export async function PATCH(request: Request, context: { params: Promise<{ doorKey: string }> }) {
  try {
    assertCentralEnabled();
    const body = await request.json() as { selected?: unknown; direction?: unknown };
    const doorKey = (await context.params).doorKey;
    if (body.direction === "up" || body.direction === "down") {
      await moveSelectedDoor(doorKey, body.direction);
      return NextResponse.json({ ok: true, data: { direction: body.direction } });
    }
    if (typeof body.selected !== "boolean") throw new Error("选择状态无效");
    await setProviderDoorSelected(doorKey, body.selected);
    return NextResponse.json({ ok: true, data: { selected: body.selected } });
  } catch (error) { return jsonError(error); }
}
