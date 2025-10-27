import { GoogleGenAI, Type } from "@google/genai";

let ai: GoogleGenAI | null = null;

// Lazily initialize the GoogleGenAI client to prevent app crashes on load.
// This ensures the API key is present before the client is created.
const getAiClient = (): GoogleGenAI => {
    if (ai) {
        return ai;
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        throw new Error("API_KEY environment variable not set. Please configure it.");
    }
    ai = new GoogleGenAI({ apiKey });
    return ai;
};


const schema = {
  type: Type.OBJECT,
  properties: {
    startTime: {
      type: Type.NUMBER,
      description: "The optimal time in seconds to start playing the track, usually where the first main beat or melody begins, skipping any long silent intros.",
    },
    endTime: {
      type: Type.NUMBER,
      description: "The optimal time in seconds to stop playback for the selected segment. Limit the total segment length to 120 seconds or less.",
    },
  },
  required: ["startTime", "endTime"],
};


export async function getMixPointsFromGemini(
    trackName: string,
    duration: number,
    promptAddendum?: string,
): Promise<{ startTime: number; endTime: number }> {
    const trimmedAddendum = promptAddendum?.trim();
    const basePrompt = `あなたは熟練のクラブDJです。次の楽曲について、最適なミックス・ポイントを決定してください。

    楽曲名: "${trackName}"
    総再生時間: 約 ${Math.round(duration)} 秒

    求めるタイムスタンプは以下の2点です。
    1. **startTime** – セグメント再生を開始するタイミング。無音・長いイントロや不要な前奏を避け、ビートやメロディが立ち上がる地点を選んでください。
    2. **endTime** – セグメント再生を終了するタイミング。フェード処理は別のシステムで行うため、最適な終了位置だけを返してください。startTime から endTime までの長さは必ず 120 秒以下にしてください。

    制約:
    - startTime は 0 秒以上で、endTime より必ず小さくすること。
    - endTime は曲の総再生時間以下とし、startTime との差が 30〜120 秒の間に収まるよう配慮してください。

    以上の条件に沿って、指定された JSON スキーマで回答してください。`;
    const prompt = trimmedAddendum
        ? `${basePrompt}\n\nAdditional DJ preferences:\n${trimmedAddendum}`
        : basePrompt;

    try {
        const client = getAiClient();
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: schema,
            },
        });

        const jsonText = response.text.trim();
        const mixPoints = JSON.parse(jsonText);

        // Basic validation
        if (typeof mixPoints.startTime !== 'number' || typeof mixPoints.endTime !== 'number') {
            throw new Error("Invalid data types from Gemini.");
        }
        if (mixPoints.startTime >= mixPoints.endTime || mixPoints.endTime > duration) {
            console.warn("Gemini returned illogical timestamps, falling back to default.", mixPoints);
            // Fallback for illogical values
            const safeEnd = Math.min(duration, Math.max(0, mixPoints.startTime + 90));
            return { startTime: Math.max(0, Math.min(mixPoints.startTime, duration)), endTime: safeEnd };
        }

        return mixPoints;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get mix points from AI.");
    }
}
