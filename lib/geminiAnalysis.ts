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
    const basePrompt = `You are an expert DJ. Analyze the following music track to find the best mix points.

    Track Name: "${trackName}"
    Total Duration: ${Math.round(duration)} seconds.

    Your task is to identify two key timestamps:
    1.  **Start Time**: The ideal moment to start the track. This should be right where the main beat or rhythm kicks in, skipping any silence, long ambient intros, or non-rhythmic sections.
    2.  **Fade-Out Time**: The ideal moment to begin a crossfade to the next track. This should be at the start of the outro, where the song's energy begins to decrease, but before it ends completely.

    Constraints:
    - The startTime must be greater than or equal to 0 and less than the fadeOutTime.
    - The fadeOutTime must be less than the total duration. A good rule of thumb is that it should be within the last 20% of the track.

    Provide the response as a JSON object with the specified schema.`;
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
