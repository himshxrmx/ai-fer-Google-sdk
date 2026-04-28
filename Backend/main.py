import os
import time
import json
import base64
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google import genai
from google.genai import types
from google.cloud import firestore

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize clients (globally to reuse across invocations)
db = firestore.Client() if os.environ.get("GOOGLE_CLOUD_PROJECT") else None

API_KEY = os.environ.get("GEMINI_API_KEY")

# Initialize Gemini Client (GenAI SDK)
client = genai.Client(api_key=API_KEY) if API_KEY else None

PROMPT = """Analyze the classroom image. Count the number of students exhibiting each of these precise emotions: happy, neutral, bored, sad, angry, surprised. 
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
"""

@app.post("/analyze")
async def analyze_image(request: Request):
    t0 = time.perf_counter()
    
    try:
        body = await request.json()
        image_data = body.get("image")
        
        if not image_data:
            raise HTTPException(status_code=400, detail="Missing 'image' in payload")

        # Strip prefix if present (e.g., 'data:image/jpeg;base64,...')
        if "," in image_data:
            image_data = image_data.split(",")[1]
            
        image_bytes = base64.b64decode(image_data)
        
    except Exception as e:
        raise HTTPException(status_code=400, detail="Invalid Base64 payload")

    if not client:
        raise HTTPException(status_code=500, detail="Gemini API not configured")

    t1 = time.perf_counter()
    
    try:
        # Call Gemini Pro Vision
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[
                types.Part.from_bytes(data=image_bytes, mime_type='image/jpeg'),
                PROMPT
            ],
            config=types.GenerateContentConfig(
                temperature=0.0,
                response_mime_type="application/json"
            )
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Inference failed: {str(e)}")
        
    t2 = time.perf_counter()
    
    try:
        raw_text = response.text
        # Optional sanitization if response_mime_type doesn't strip markdown wrapper
        if raw_text.startswith("```json"):
            raw_text = raw_text.split("```json")[1].split("```")[0].strip()
        elif raw_text.startswith("```"):
            raw_text = raw_text.split("```")[1].split("```")[0].strip()
            
        data = json.loads(raw_text)
        
        # Derived metrics Calculation
        total = data.get("total_students", 0)
        
        if total > 0:
            eng_pct = ((data.get("happy",0) + data.get("neutral",0) + data.get("surprised",0)) / total) * 100
            
            # Weighted Attention Score
            # Params: (Happy * 1.5 + Neutral * 1.0 + Surprised * 1.2 - Bored * 1.0 - Sad * 0.5 - Angry * 0.5) / Total
            att_score = (
                data.get("happy",0) * 1.5 + 
                data.get("neutral",0) * 1.0 + 
                data.get("surprised",0) * 1.2 - 
                data.get("bored",0) * 1.0 - 
                data.get("sad",0) * 0.5 - 
                data.get("angry",0) * 0.5
            ) / total
            
            emotions = ["happy", "neutral", "bored", "sad", "angry", "surprised"]
            dominant = max(emotions, key=lambda e: data.get(e, 0))
        else:
            eng_pct = 0.0
            att_score = 0.0
            dominant = "none"
            
        inference_latency_ms = round((t2 - t1) * 1000, 2)
        
        res_payload = {
            "total_students": total,
            "happy": data.get("happy", 0),
            "neutral": data.get("neutral", 0),
            "bored": data.get("bored", 0),
            "sad": data.get("sad", 0),
            "angry": data.get("angry", 0),
            "surprised": data.get("surprised", 0),
            "engagement_percentage": round(eng_pct, 2),
            "attention_score": round(att_score, 2),
            "dominant_emotion": dominant,
            "inference_latency_ms": inference_latency_ms,
            "total_latency_ms": 0.0 # Will be overwritten below
        }
        
        # Async-ish write to Firestore (Synchronous here for exact metric mapping, scales automatically in cloud)
        if db:
            db.collection("analytics_records").add({
                **res_payload,
                "timestamp": firestore.SERVER_TIMESTAMP
            })
            
        # Total overall latency
        t_final = time.perf_counter()
        res_payload["total_latency_ms"] = round((t_final - t0) * 1000, 2)
        
        return res_payload

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing failed: {str(e)}")

@app.get("/records")
def get_records():
    # Helper endpoint for the Frontend Dashboard to visualize historical data
    if not db:
        return []
        
    docs = db.collection("analytics_records").order_by(
        "timestamp", direction=firestore.Query.DESCENDING
    ).limit(30).stream()
    
    results = []
    for doc in docs:
        d = doc.to_dict()
        # Transform for Dashboard parsing
        res = {
            "total_students": d.get("total_students", 0),
            "engaged": d.get("happy",0) + d.get("neutral",0) + d.get("surprised",0),
            "not_engaged": d.get("bored",0) + d.get("sad",0) + d.get("angry",0),
            "engagement_percentage": d.get("engagement_percentage", 0),
        }
        # Insert chronologically for plotting
        results.insert(0, res)
        
    return results
