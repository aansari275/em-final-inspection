#!/usr/bin/env python3
"""Generate professional AQL Z1.4-2008 chart using Gemini 3 Pro (nano banana pro)"""

import os
from google import genai
from google.genai import types

# Get API key from environment
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY')
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set")

client = genai.Client(api_key=GEMINI_API_KEY)

# Clean Scandinavian style prompt
prompt = """Create a clean, minimalist AQL sampling reference chart with Scandinavian design aesthetics.

DESIGN STYLE:
- Pure white background
- Modern sans-serif typography (like Helvetica or Arial)
- Lots of whitespace
- Subtle teal (#0d9488) for headers
- Green (#16a34a) for Accept numbers
- Red (#dc2626) for Reject numbers
- Very clean, professional, easy to read
- No decorations, shadows, or gradients

LAYOUT - Two tables side by side:

LEFT TABLE titled "LOT SIZE → CODE"
Two columns: Lot Size | Code
2-8 → A
9-15 → B
16-25 → C
26-50 → D
51-90 → E
91-150 → F
151-280 → G
281-500 → H
501-1200 → J
1201-3200 → K
3201-10000 → L
10001-35000 → M
35001-150000 → N
150001-500000 → P
500001+ → Q

RIGHT TABLE titled "ACCEPT / REJECT BY AQL"
Columns: Code | Sample | AQL 1.0 | AQL 2.5 | AQL 4.0
Each AQL column has Ac (green) and Re (red) subcolumns
E | 13 | 0/1 | 0/1 | 1/2
F | 20 | 0/1 | 1/2 | 1/2
G | 32 | 0/1 | 1/2 | 2/3
H | 50 | 1/2 | 2/3 | 3/4
J | 80 | 1/2 | 3/4 | 5/6
K | 125 | 2/3 | 5/6 | 7/8
L | 200 | 3/4 | 7/8 | 10/11
M | 315 | 5/6 | 10/11 | 14/15
N | 500 | 7/8 | 14/15 | 21/22

MAIN TITLE: "AQL Z1.4-2008" centered at top
SUBTITLE: "Level II Normal Inspection"

FOOTER: "Ac = Accept if defects ≤  |  Re = Reject if defects ≥  |  ANSI/ASQ Standard"

Make the text VERY CLEAR and PERFECTLY READABLE. Professional quality control document."""

print("Generating AQL chart with Gemini 3 Pro (nano banana pro)...")

resp = client.models.generate_content(
    model="gemini-3-pro-image-preview",
    contents=prompt,
    config=types.GenerateContentConfig(
        image_config=types.ImageConfig(
            aspect_ratio="4:3",
            image_size="2K"
        )
    )
)

# Save the image
for part in resp.candidates[0].content.parts:
    if part.inline_data is not None:
        image_data = part.inline_data.data
        filename = "public/img/aql_chart_gemini3.png"
        with open(filename, "wb") as f:
            f.write(image_data)
        print(f"Saved: {filename}")
        break

print("\nDone!")
