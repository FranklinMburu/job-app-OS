import re

def clean_text(text: str) -> str:
    """
    Cleans extracted visible page text:
    - Normalizes multi-line blank gaps (consecutive \n) to at most a double newline.
    - Trims leading/trailing whitespace on each line.
    - Preserves logical document layouts, headers, and bullet structures.
    """
    if not text:
        return ""
        
    lines = [line.strip() for line in text.splitlines()]
    
    cleaned_lines = []
    prev_blank = False
    
    for line in lines:
        if not line:
            if not prev_blank:
                cleaned_lines.append("")
                prev_blank = True
        else:
            cleaned_lines.append(line)
            prev_blank = False
            
    return "\n".join(cleaned_lines).strip()
