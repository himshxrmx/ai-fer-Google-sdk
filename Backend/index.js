const express = require('express');
const cors = require('cors');
const { Firestore } = require('@google-cloud/firestore');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Initialize clients (globally to reuse across invocations)
const projectId = process.env.GOOGLE_CLOUD_PROJECT;
let db = null;
if (projectId) {
    db = new Firestore({ projectId });
}

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : null;
let ai = null;
if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
    console.log('Gemini AI client initialized successfully');
} else {
    console.error('WARNING: GEMINI_API_KEY not set!');
}

const PROMPT = `Analyze the classroom image. Count the number of students exhibiting each of these precise emotions: happy, neutral, bored, sad, angry, surprised. 
Return STRICT JSON ONLY, matching exactly this structure:
{
  "total_students": 0,
  "happy": 0,
  "neutral": 0,
  "bored": 0,
  "sad": 0,
  "angry": 0,
  "surprised": 0
}
No markdown, no explanation, just the raw JSON object.
`;

app.post('/analyze', async (req, res) => {
    const t0 = performance.now();

    try {
        let imageData = req.body.image;

        if (!imageData) {
            return res.status(400).json({ detail: "Missing 'image' in payload" });
        }

        // Strip prefix if present (e.g., 'data:image/jpeg;base64,...')
        if (imageData.includes(',')) {
            imageData = imageData.split(',')[1];
        }

        if (!ai) {
            return res.status(500).json({ detail: "Gemini API not configured" });
        }

        const t1 = performance.now();
        let response;
        try {
            response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [
                    {
                        role: 'user',
                        parts: [
                            {
                                inlineData: {
                                    mimeType: 'image/jpeg',
                                    data: imageData,
                                }
                            },
                            { text: PROMPT }
                        ]
                    }
                ],
                config: {
                    temperature: 0.0,
                    responseMimeType: 'application/json'
                }
            });
        } catch (e) {
            console.error('Gemini inference error:', e.message, e.stack);
            return res.status(500).json({ detail: `Inference failed: ${e.message}` });
        }

        const t2 = performance.now();

        try {
            let rawText = response.text;
            // Optional sanitization if response_mime_type doesn't strip markdown wrapper
            if (rawText.startsWith("```json")) {
                rawText = rawText.split("```json")[1].split("```")[0].trim();
            } else if (rawText.startsWith("```")) {
                rawText = rawText.split("```")[1].split("```")[0].trim();
            }

            const data = JSON.parse(rawText);

            // Derived metrics Calculation
            const total = data.total_students || 0;
            let engPct = 0.0;
            let attScore = 0.0;
            let dominant = "none";

            if (total > 0) {
                const happy = data.happy || 0;
                const neutral = data.neutral || 0;
                const surprised = data.surprised || 0;
                const bored = data.bored || 0;
                const sad = data.sad || 0;
                const angry = data.angry || 0;

                engPct = ((happy + neutral + surprised) / total) * 100;

                attScore = (
                    happy * 1.5 +
                    neutral * 1.0 +
                    surprised * 1.2 -
                    bored * 1.0 -
                    sad * 0.5 -
                    angry * 0.5
                ) / total;

                const emotions = { happy, neutral, bored, sad, angry, surprised };
                dominant = Object.keys(emotions).reduce((a, b) => emotions[a] > emotions[b] ? a : b);
            }

            const inferenceLatencyMs = Number((t2 - t1).toFixed(2));

            const resPayload = {
                total_students: total,
                happy: data.happy || 0,
                neutral: data.neutral || 0,
                bored: data.bored || 0,
                sad: data.sad || 0,
                angry: data.angry || 0,
                surprised: data.surprised || 0,
                engagement_percentage: Number(engPct.toFixed(2)),
                attention_score: Number(attScore.toFixed(2)),
                dominant_emotion: dominant,
                inference_latency_ms: inferenceLatencyMs,
                total_latency_ms: 0.0
            };

            if (db) {
                // Store a small thumbnail version of the image for history display
                // Truncate to max 100KB of base64 to avoid Firestore document size limits
                const thumbnailData = imageData.substring(0, 100000);
                await db.collection("analytics_records").add({
                    ...resPayload,
                    image_thumbnail: thumbnailData,
                    timestamp: Firestore.FieldValue.serverTimestamp()
                });
            }

            const tFinal = performance.now();
            resPayload.total_latency_ms = Number((tFinal - t0).toFixed(2));

            return res.json(resPayload);

        } catch (e) {
            return res.status(500).json({ detail: `Processing failed: ${e.message}` });
        }

    } catch (e) {
        return res.status(500).json({ detail: `Unexpected Error: ${e.message}` });
    }
});

app.get('/records', async (req, res) => {
    if (!db) {
        return res.json([]);
    }

    try {
        const snapshot = await db.collection("analytics_records")
            .orderBy("timestamp", "desc")
            .limit(30)
            .get();

        const results = [];
        snapshot.forEach(doc => {
            const d = doc.data();
            const resData = {
                id: doc.id,
                total_students: d.total_students || 0,
                happy: d.happy || 0,
                neutral: d.neutral || 0,
                bored: d.bored || 0,
                sad: d.sad || 0,
                angry: d.angry || 0,
                surprised: d.surprised || 0,
                engaged: (d.happy || 0) + (d.neutral || 0) + (d.surprised || 0),
                not_engaged: (d.bored || 0) + (d.sad || 0) + (d.angry || 0),
                engagement_percentage: d.engagement_percentage || 0,
                attention_score: d.attention_score || 0,
                dominant_emotion: d.dominant_emotion || 'none',
                image_thumbnail: d.image_thumbnail || null,
                timestamp: d.timestamp ? d.timestamp.toDate().toISOString() : null,
            };
            results.push(resData);
        });

        return res.json(results);
    } catch (e) {
        return res.status(500).json({ detail: `Database fetch failed: ${e.message}` });
    }
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
