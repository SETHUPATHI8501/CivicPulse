import re
from typing import Dict, Optional

# Supported municipal categories and fixed department mappings
CATEGORY_DEPARTMENT_MAP = {
    "Pothole": "Roads / Public Works",
    "Garbage": "Sanitation",
    "Water": "Water Supply",
    "Streetlight": "Electrical",
    "Drainage": "Drainage / Public Works",
    "Other": "General",
}

VALID_CATEGORIES = set(CATEGORY_DEPARTMENT_MAP.keys())
VALID_PRIORITIES = {"HIGH", "MEDIUM", "LOW"}

# Multilingual keywords supporting Tamil and English
CATEGORY_KEYWORDS = {
    "Pothole": [
        "pothole", "potholes", "road damage", "crater", "craters",
        "broken road", "damaged road", "road crack", "asphalt",
        "குழி", "பள்ளம்", "சாலை சேதம்", "ரோடு சேதம்", "குண்டுகுழி"
    ],
    "Garbage": [
        "garbage", "waste", "trash", "rubbish", "litter",
        "dump", "dumping", "dustbin", "foul smell", "stink", "debris",
        "குப்பை", "கழிவு", "துர்நாற்றம்", "குப்பைத்தொட்டி", "அழுக்கு"
    ],
    "Water": [
        "water leakage", "water supply", "pipe burst", "water leak",
        "drinking water", "leaking pipe", "no water", "pipeline", "water pipe",
        "தண்ணீர்", "குடிநீர்", "நீர் கசிவு", "குழாய் உடைப்பு", "தண்ணீர் வரவில்லை"
    ],
    "Streetlight": [
        "streetlight", "street light", "street lamp", "lamp",
        "light not working", "dark street", "flickering", "darkness", "bulb",
        "தெருவிளக்கு", "விளக்கு எரியவில்லை", "மின்விளக்கு", "இருட்டாக உள்ளது"
    ],
    "Drainage": [
        "drainage", "sewage", "gutter", "manhole", "drain",
        "overflow", "sewer", "stagnant water", "choked", "clogged",
        "கழிவுநீர்", "சாக்கடை", "பாதாள சாக்கடை", "வடிகால்", "சாக்கடை நீர்"
    ],
}

HIGH_PRIORITY_KEYWORDS = [
    "accident", "accidents", "danger", "dangerous", "hazard", "hazardous",
    "severe", "deep", "burst", "emergency", "injury", "injuries", "sparking",
    "spark", "fire", "fatal", "flooding", "flood", "open manhole",
    "விபத்து", "ஆபத்து", "அபாயம்", "உயிர்", "காயம்", "அவசரம்", "தீவிரம்", "வெடித்தது"
]

LOW_PRIORITY_KEYWORDS = [
    "minor", "cosmetic", "small", "slight", "faded", "slow", "dim",
    "சின்ன", "சிறிய", "மெதுவாக", "லேசான"
]


def normalize_text(text: str) -> str:
    """Normalize input text by lowercasing and standardizing whitespace."""
    if not text:
        return ""
    return re.sub(r"\s+", " ", text.strip().lower())


def classify_fallback(
    citizen_text: str,
    voice_transcript: Optional[str] = None,
) -> Dict[str, str]:
    """
    Classify a civic complaint using keyword matching for English and Tamil.
    Returns:
    {
        "category": "Pothole" | "Garbage" | "Water" | "Streetlight" | "Drainage" | "Other",
        "priority": "HIGH" | "MEDIUM" | "LOW",
        "department": "<Department Name>",
        "reason": "<Explanation>",
        "ai_source": "RULE_BASED_FALLBACK"
    }
    """
    combined = f"{citizen_text or ''} {voice_transcript or ''}".strip()
    norm = normalize_text(combined)

    matched_category = "Other"
    best_score = 0
    matched_reason = "No specific civic category keyword matched. Assigned to General."

    # Evaluate category keyword occurrences
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in norm)
        if score > best_score:
            best_score = score
            matched_category = category
            matched_reason = f"Keyword match identified civic category as {category}."

    # Determine priority
    has_high = any(hk in norm for hk in HIGH_PRIORITY_KEYWORDS)
    has_low = any(lk in norm for lk in LOW_PRIORITY_KEYWORDS)

    if has_high:
        priority = "HIGH"
        matched_reason += " High safety risk/hazard keywords detected."
    elif has_low and not has_high:
        priority = "LOW"
        matched_reason += " Minor/cosmetic condition keywords detected."
    else:
        priority = "MEDIUM"
        if matched_category != "Other":
            matched_reason += " Standard civic issue requiring departmental attention."

    department = CATEGORY_DEPARTMENT_MAP[matched_category]

    return {
        "category": matched_category,
        "priority": priority,
        "department": department,
        "reason": matched_reason,
        "ai_source": "RULE_BASED_FALLBACK",
    }

