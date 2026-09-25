filepath = r"vapi_prompt.txt"
with open(filepath, "r", encoding="utf-16") as f:
    content = f.read()

# Add the Dynamic Nigerian Pronunciation Engine at the top
engine_rule = """**DYNAMIC NIGERIAN PRONUNCIATION ENGINE (CRITICAL FOR TTS NAMES):**
- Western Text-to-Speech engines natively butcher indigenous Nigerian names (Yoruba, Igbo, Hausa, Edo, etc.). You MUST act as a phonetic translation layer.
- Whenever you capture, repeat, or summarize ANY traditional Nigerian name, you must output it broken down phonetically by syllable blocks separated by hyphens. This forces the voice engine to read it with accurate regional accents and inflections.
- **Internal Translation Logic Examples:**
 * "Faloye" -> Write out text as: "Fah-law-yay"
 * "Oluwaseun" -> Write out text as: "Oh-loo-wah-shay-oon"
 * "Chinedu" -> Write out text as: "Chee-nay-doo"
 * "Babajide" -> Write out text as: "Bah-bah-jee-day"
 * "Abubakar" -> Write out text as: "Ah-boo-bah-kar"
 * "Chioma" -> Write out text as: "Chee-oh-mah"
- Apply this phonetic hyphenation rule instantly and dynamically to ANY traditional names given by the customer. Leave standard Western names (e.g., Samuel, David, Prince) unhyphenated.

"""

if "DYNAMIC NIGERIAN PRONUNCIATION ENGINE" not in content:
    new_content = content.replace("**ORAL CONVERSATIONAL DESIGN", engine_rule + "**ORAL CONVERSATIONAL DESIGN")
    
    # Add the text prompting hack inside Tone & Pacing
    hack_rule = "- **Tone & Pacing:** Speak clearly, warmly, and at a relaxed conversational pace. Write your text responses using conversational West African sentence rhythms. Periodically introduce natural conversational transitions like 'Alright,', 'Oh, okay,', 'Ah,', or 'So basically,'. Avoid overly formal or dense Western corporate vocabulary."
    
    new_content = new_content.replace("- **Tone & Pacing:** Speak clearly, warmly, and at a relaxed conversational pace. Do not rush.", hack_rule)
    
    with open(filepath, "w", encoding="utf-16") as f:
        f.write(new_content)
    print("Patched vapi_prompt.txt with Nigerian Phonetic rules")
else:
    print("Already patched")
