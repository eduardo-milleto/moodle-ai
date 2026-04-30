import { setTaskDone } from "@moodle-ai/db";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth";
import { serializeTask } from "@/lib/serializers";

const updateSchema = z.object({
  manuallyDone: z.boolean()
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAuth();
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const { id } = await params;
  const task = await setTaskDone(id, parsed.data.manuallyDone);

  if (!task) {
    return NextResponse.json({ error: "Tarefa não encontrada" }, { status: 404 });
  }

  return NextResponse.json({ task: serializeTask(task) });
}

