import re

def sanitize_text(value: str, max_length: int = 500) -> str:
    """Sanitize generic text against HTML/XSS injection and prompt injection phrases."""
    if not isinstance(value, str):
        return ""
        
    # 1. Strip HTML tags to prevent XSS
    value = re.sub(r'<[^>]*>', '', value)
    
    # 2. Redact common prompt injection patterns
    injection_patterns = [
        r"(?i)ignore\s+all\s+previous\s+instructions",
        r"(?i)system\s+instruction",
        r"(?i)forget\s+everything",
        r"(?i)drop\s+database",
        r"(?i)delete\s+all",
        r"(?i)delete\s+graph",
        r"(?i)clear\s+graph"
    ]
    for pattern in injection_patterns:
        value = re.sub(pattern, "[redacted]", value)
        
    # 3. Remove non-printable characters
    value = "".join(ch for ch in value if ch.isprintable() or ch in ('\n', '\r', '\t'))
    
    # 4. Normalize whitespaces
    value = " ".join(value.split())
    
    # 5. Truncate
    if len(value) > max_length:
        value = value[:max_length].strip()
        
    return value


def sanitize_label(label: str, default: str = "Concept") -> str:
    """Strictly sanitize a database label/type (Neo4j labels must be safe from Cypher injection)."""
    if not isinstance(label, str):
        return default
        
    # Replace spaces with underscores
    label = label.strip().replace(" ", "_")
    
    # Keep ONLY alphanumeric and underscores
    sanitized = re.sub(r'[^a-zA-Z0-9_]', '', label)
    
    return sanitized if sanitized else default


# Common offensive words, slurs, and hate speech indicators to filter out of graph extraction
OFFENSIVE_WORDS = {
    "nigger", "nigga", "niga", "chink", "kike", "spic", "wog", "wetback", "coon", "paki", "raghead",
    "faggot", "fag", "tranny", "dyke", "negro",
    "whore", "cunt", "slut", "bitch"
}

def contains_profanity_or_slur(text: str) -> bool:
    """Check if the text contains common slurs, hate speech, or offensive patterns."""
    if not isinstance(text, str) or not text.strip():
        return False
        
    # Convert to lowercase
    normalized = text.lower()
    
    # 1. Substitute common leetspeak characters
    subs = {
        '1': 'i', '!': 'i', '|': 'i', '3': 'e', '4': 'a', '@': 'a', 
        '0': 'o', '5': 's', '$': 's', '7': 't', '9': 'g', '8': 'b'
    }
    for char, replacement in subs.items():
        normalized = normalized.replace(char, replacement)
        
    # 2. Check word-by-word for exact matches after cleaning and collapsing
    # This prevents false positives like "con" (from "coon") matching in "consumption" or "tebuconazole"
    words = re.findall(r'[a-z0-9!\@\#\$\%\^\&\*\(\)\-\_\+\=\[\]\{\}\;\:\'\"\,\<\.\>\/\?\\\|]+', normalized)
    for word in words:
        # Clean punctuation
        cleaned_word = re.sub(r'[^a-z]', '', word)
        if not cleaned_word:
            continue
        # Collapse repeated characters (e.g. niggger -> niger)
        collapsed_word = re.sub(r'(.)\1+', r'\1', cleaned_word)
        
        # Check exact matches
        for off_word in OFFENSIVE_WORDS:
            collapsed_off = re.sub(r'(.)\1+', r'\1', off_word)
            if collapsed_word == collapsed_off:
                return True
                
    # 3. Check for specific highly-offensive substrings in the cleaned document text
    # But only for long/specific words to avoid false positives on short sequences
    cleaned_all = re.sub(r'[^a-z]', '', normalized)
    for off_word in OFFENSIVE_WORDS:
        # Skip short words for substring matching to avoid false positives (like "wog" or "fag" or "coon" matching inside other words)
        if len(off_word) < 5:
            continue
        if off_word in cleaned_all:
            return True
            
    # 4. Check original with regex patterns just in case
    OFFENSIVE_PATTERNS = [
        r"(?i)\bnigg?g?g?er\b",
        r"(?i)\bnigg?g?a\b",
        r"(?i)\bchink\b",
        r"(?i)\bkike\b",
        r"(?i)\bspic\b",
        r"(?i)\bwog\b",
        r"(?i)\bwetback\b",
        r"(?i)\bcoon\b",
        r"(?i)\bpaki\b",
        r"(?i)\braghead\b",
        r"(?i)\bnegro\b",
        r"(?i)\bfag(got)?\b",
        r"(?i)\btranny\b",
        r"(?i)\bdyke\b",
        r"(?i)\bwhore\b",
        r"(?i)\bcunt\b",
        r"(?i)\bslut\b",
        r"(?i)\bbitch\b"
    ]
    for pattern in OFFENSIVE_PATTERNS:
        if re.search(pattern, text):
            return True
            
    return False

