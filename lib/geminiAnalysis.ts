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
    fadeOutTime: {
      type: Type.NUMBER,
      description: "The optimal time in seconds to start fading out the track, usually at the beginning of an outro section or after the main climax.",
    },
  },
  required: ["startTime", "fadeOutTime"],
};


export async function getMixPointsFromGemini(
    trackName: string,
    duration: number,
    promptAddendum?: string,
): Promise<{ startTime: number; fadeOutTime: number }> {
    const trimmedAddendum = promptAddendum?.trim();
    const basePrompt = `あなたは熟練のクラブDJです。次の楽曲について、最適なミックス・ポイントを決定してください。

    楽曲名: "${trackName}"
    総再生時間: 約 ${Math.round(duration)} 秒

    求めるタイムスタンプは以下の2点です。
    1. **startTime** – 曲を再生し始めるべき最適なタイミング。無音・パッド・長いイントロを避け、ビートやメロディが本格的に立ち上がる地点を選んでください。
    2. **fadeOutTime** – 次の曲へクロスフェードを開始する最適なタイミング。最後のサビが終わった直後（観客の熱量がピークのうち）に入るポイントを優先し、曲の終端より 10 秒以上手前に設定してください。フェードに使う時間（startTime から fadeOutTime までの長さ）は 8〜16 秒程度を目安にします。

    制約:
    - startTime は 0 秒以上で、fadeOutTime より必ず小さくすること。
    - fadeOutTime は曲の総再生時間未満、かつ曲の終端より 10 秒以上手前にすること。

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
        if (typeof mixPoints.startTime !== 'number' || typeof mixPoints.fadeOutTime !== 'number') {
            throw new Error("Invalid data types from Gemini.");
        }
        if (mixPoints.startTime >= mixPoints.fadeOutTime || mixPoints.fadeOutTime > duration) {
            console.warn("Gemini returned illogical timestamps, falling back to default.", mixPoints);
            // Fallback for illogical values
            return { startTime: 0, fadeOutTime: duration * 0.9 };
        }
        
        return mixPoints;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error("Failed to get mix points from AI.");
    }
}
