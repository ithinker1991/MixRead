
def stem(word):
    if not word or len(word) < 3: return word
    word = word.lower().strip()
    
    # Rule 3: Remove 'ing'
    if word.endswith('ing') and len(word) > 5:
        base = word[:-3]
        if len(base) >= 2:
            # Check for double consonants (simplified)
            if base[-1] == base[-2]:
                return base[:-1]
        return base
        
    # Rule 4: Remove 'er'
    if word.endswith('er') and len(word) > 4:
        base = word[:-2]
        if len(base) >= 2:
            return base
            
    return word

print(f"firing -> {stem('firing')}")
print(f"other -> {stem('other')}")
