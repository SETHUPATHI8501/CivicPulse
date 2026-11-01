import concurrent.futures
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, Optional
from dotenv import load_dotenv

from services.fallback_classifier import (
    CATEGORY_DEPARTMENT_MAP,
    VALID_CATEGORIES,
    VALID_PRIORITIES,
    classify_fallback,
)

# Configure logger
logger = logging.getLogger("civicpulse.ai_classifier")

# Load .env explicitly from backend directory
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# Classification timeout constraint (approx 3 seconds)
CLASSIFICATION_TIMEOUT_SECONDS = 3.0

SYSTEM_INSTRUCTION = (
    "You are the expert AI triage system for CivicPulse AI, a municipal complaint platform. "
    "Classify the citizen complaint into EXACTLY ONE category from this list: "
    "['Pothole', 'Garbage', 'Water', 'Streetlight', 'Drainage', 'Other'].\n"
    "Map to the exact corresponding department:\n"
    "- Pothole -> Roads / Public Works\n"
    "- Garbage -> Sanitation\n"
    "- Water -> Water Supply\n"
    "- Streetlight -> Electrical\n"
    "- Drainage -> Drainage / Public Works\n"
    "- Other -> General\n"
    "Classify priority into EXACTLY ONE: ['HIGH', 'MEDIUM', 'LOW'].\n"
    "- HIGH: Immediate danger to people, major road hazard, open manhole, bursting pipe, live sparking wire.\n"
    "- MEDIUM: Normal civic issue requiring municipal attention, accumulated garbage, unlit streetlight.\n"
    "- LOW: Minor or cosmetic issue with no safety risk.\n"
    "Return ONLY a valid JSON object matching this schema:\n"
    "{\n"
    '  "category": "Pothole",\n'
    '  "priority": "HIGH",\n'
    '  "department": "Roads / Public Works",\n'
    '  "reason": "Short explanation"\n'
    "}"
)


def get_gemini_config() -> tuple[str, str]:
    """Retrieve Gemini API key and model from environment configuration."""
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash").strip()
    return api_key, model


def validate_ai_response(raw_response_text: str) -> Optional[Dict[str, str]]:
    """
    Validate and extract structured JSON from the AI output.
    Ensures strict adherence to allowed categories, priorities, and department mappings.
    """
    if not raw_response_text or not raw_response_text.strip():
        return None

    try:
        # Strip potential markdown code fence markers (e.g. ```json ... ```)
        cleaned = raw_response_text.strip()
        if cleaned.startswith("```"):
            cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
            cleaned = re.sub(r"\s*```$", "", cleaned)

        data = json.loads(cleaned)
        if not isinstance(data, dict):
            return None

        category = str(data.get("category", "")).strip()
        priority = str(data.get("priority", "")).strip().upper()
        reason = str(data.get("reason", "Classified by Gemini AI")).strip()

        # Reject unrecognized categories or priorities
        if category not in VALID_CATEGORIES:
            logger.warning("Gemini returned invalid category: %s", category)
            return None

        if priority not in VALID_PRIORITIES:
            logger.warning("Gemini returned invalid priority: %s", priority)
            return None

        # Enforce strict department mapping based on category
        department = CATEGORY_DEPARTMENT_MAP[category]

        return {
            "category": category,
            "priority": priority,
            "department": department,
            "reason": reason,
            "ai_source": "GEMINI",
        }
    except (json.JSONDecodeError, Exception) as exc:
        logger.warning("Failed to parse Gemini response as JSON: %s", exc)
        return None


def _call_gemini_api(
    client: Any,
    model: str,
    prompt: str,
) -> str:
    """Invoke the official google-genai Client to generate structured content."""
    response = client.models.generate_content(
        model=model,
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "system_instruction": SYSTEM_INSTRUCTION,
        },
    )
    return getattr(response, "text", "") or ""


def classify_complaint(
    citizen_text: str,
    voice_transcript: Optional[str] = None,
    gemini_client: Optional[Any] = None,
) -> Dict[str, str]:
    """
    Primary complaint classification entry point:
    1. Attempts classification via Gemini AI within a ~3 second timeout.
    2. Validates the structured output.
    3. If Gemini is unavailable, invalid, timed out, or unconfigured,
       automatically falls back to the rule-based English & Tamil classifier.
    Never raises an unhandled exception or blocks complaint submission.
    """
    api_key, model_name = get_gemini_config()
    client = gemini_client

    # Check whether Gemini can be used
    can_use_gemini = False
    if client is not None:
        can_use_gemini = True
    elif api_key and not api_key.startswith("your_") and len(api_key) > 10:
        try:
            from google import genai
            client = genai.Client(api_key=api_key)
            can_use_gemini = True
        except Exception as init_err:
            logger.warning("Failed to initialize google-genai client: %s", init_err)
            can_use_gemini = False

    if can_use_gemini and client is not None:
        combined_text = f"Citizen Description: {citizen_text}"
        if voice_transcript:
            combined_text += f"\nVoice Transcript (Tamil/English): {voice_transcript}"

        prompt = (
            f"Analyze and classify this civic complaint:\n{combined_text}\n"
            "Respond ONLY with the JSON object."
        )

        try:
            executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
            try:
                future = executor.submit(_call_gemini_api, client, model_name, prompt)
                raw_text = future.result(timeout=CLASSIFICATION_TIMEOUT_SECONDS)
            finally:
                executor.shutdown(wait=False, cancel_futures=True)

            validated_result = validate_ai_response(raw_text)
            if validated_result is not None:
                return validated_result
            else:
                logger.info("Gemini output validation failed. Using rule-based fallback.")
        except concurrent.futures.TimeoutError:
            logger.warning("Gemini classification timed out (> %.1fs). Falling back.", CLASSIFICATION_TIMEOUT_SECONDS)
        except Exception as exc:
            logger.warning("Gemini API call failed (%s). Falling back.", exc)

    # Automatic fallback to rule-based Tamil & English classifier
    return classify_fallback(citizen_text=citizen_text, voice_transcript=voice_transcript)
