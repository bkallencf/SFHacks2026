import { generateHeatmap } from "@/lib/generateHeatmap";

export async function POST() {
    const result = await generateHeatmap({ stepDeg: 0.05 });
    return Response.json({ ok: true, ...result });
}