import logging
import math
import re
import uuid
from typing import List, Optional, Set, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session

from models import Complaint

logger = logging.getLogger("civicpulse.duplicate_detector")

# Configuration constants as specified in Phase 4 requirements
MAX_DUPLICATE_DISTANCE_METRES = 100.0
DUPLICATE_SIMILARITY_THRESHOLD = 0.60
ACTIVE_STATUSES = ["OPEN", "IN_PROGRESS", "NEEDS_INFO"]


def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two GPS coordinates in metres
    using the Haversine formula.

    Formula:
        a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
        c = 2 * atan2(√a, √(1-a))
        d = R * c  (where R = 6,371,000 metres)
    """
    R = 6371000.0  # Earth's mean radius in metres

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    # Clamp 'a' to [0.0, 1.0] to prevent mathematical domain errors
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return R * c


def normalize_text_for_similarity(text: str) -> Set[str]:
    """
    Normalize text for Jaccard similarity:
    - Converts English text to lowercase.
    - Strips punctuation and symbols while preserving Tamil Unicode characters (\u0B80-\u0BFF).
    - Returns a set of whitespace-tokenized words.
    """
    if not text:
        return set()

    # Preserve alphanumeric English characters, whitespace, and Tamil script block
    cleaned = re.sub(r"[^\w\s\u0b80-\u0bff]", " ", text.lower())
    tokens = cleaned.split()
    return set(tokens)


def calculate_jaccard_similarity(text1: str, text2: str) -> float:
    """
    Calculate token-based Jaccard similarity between two texts:
    Jaccard Similarity = Size of Intersection / Size of Union
    Returns a value between 0.0 and 1.0.
    """
    set1 = normalize_text_for_similarity(text1)
    set2 = normalize_text_for_similarity(text2)

    if not set1 or not set2:
        return 0.0

    intersection = set1 & set2
    union = set1 | set2

    if not union:
        return 0.0

    return len(intersection) / len(union)


def generate_duplicate_group_id() -> str:
    """Generate a unique duplicate group identifier (e.g. DUP-A1B2C3D4)."""
    return f"DUP-{uuid.uuid4().hex[:8].upper()}"


def detect_duplicate(
    latitude: float,
    longitude: float,
    category: str,
    text: str,
    db: Session,
) -> Optional[Tuple[Complaint, float, float]]:
    """
    Scan active complaints in SQLite to detect physical duplicates:
    1. Filter existing complaints with the identical category and active status
       (OPEN, IN_PROGRESS, or NEEDS_INFO). Excludes RESOLVED or REJECTED issues.
    2. Filter candidates within 100 metres using the Haversine formula.
    3. Calculate Jaccard text similarity on normalized token sets.
    4. Consider duplicate if similarity > 0.60.
    5. Returns (strongest_matching_complaint, similarity_score, distance_metres)
       or None if no duplicate detected.
    """
    stmt = select(Complaint).where(
        Complaint.category == category,
        Complaint.status.in_(ACTIVE_STATUSES),
    )
    candidates: List[Complaint] = list(db.execute(stmt).scalars().all())

    best_match: Optional[Complaint] = None
    best_similarity: float = 0.0
    best_distance: float = 0.0

    for candidate in candidates:
        # 1. Distance check
        dist = calculate_distance(latitude, longitude, candidate.latitude, candidate.longitude)
        if dist > MAX_DUPLICATE_DISTANCE_METRES:
            continue

        # 2. Text similarity check
        sim = calculate_jaccard_similarity(text, candidate.citizen_text)
        if sim > DUPLICATE_SIMILARITY_THRESHOLD:
            if sim > best_similarity:
                best_similarity = sim
                best_match = candidate
                best_distance = dist

    if best_match is not None:
        return best_match, best_similarity, best_distance

    return None

