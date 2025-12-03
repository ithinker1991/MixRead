"""
Download and process Words-CEFR-Dataset from GitHub
Converts CSV to optimized JSON format for fast lookup
"""

import json
import os
import csv
import httpx

CEFR_DATA_URL = "https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "data")
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "cefr_words.json")

def download_cefr_data():
    """Download Words-CEFR-Dataset from GitHub"""
    print(f"Downloading CEFR data from {CEFR_DATA_URL}...")

    try:
        response = httpx.get(CEFR_DATA_URL, timeout=30.0)
        response.raise_for_status()
        return response.text
    except Exception as e:
        print(f"Error downloading CEFR data: {e}")
        return None

def process_cefr_data(csv_content: str) -> dict:
    """
    Process CSV content and convert to optimized JSON format
    CSV format: headword,pos,CEFR,CoreInventory1,CoreInventory2,Threshold
    (from Open Language Profiles CEFR-J dataset)
    """
    cefr_dict = {}
    lines = csv_content.strip().split('\n')
    csv_reader = csv.DictReader(lines)

    for i, row in enumerate(csv_reader):
        if i % 5000 == 0:
            print(f"Processing word {i}...")

        word = row.get('headword', '').strip().lower()
        if not word:
            continue

        # Remove variants like "a.m./A.M./am/AM" and use only first variant
        word = word.split('/')[0].lower()

        cefr_level = row.get('CEFR', 'Unknown').strip()
        pos = row.get('pos', '').strip()

        cefr_dict[word] = {
            "cefr_level": cefr_level,
            "pos": pos,
        }

    return cefr_dict

def save_to_json(data: dict, output_path: str):
    """Save processed data to JSON file"""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    file_size = os.path.getsize(output_path) / 1024 / 1024  # Size in MB
    print(f"Saved {len(data)} words to {output_path} ({file_size:.2f} MB)")

def main():
    print("Starting CEFR data download and processing...")

    # Download data
    csv_content = download_cefr_data()
    if not csv_content:
        print("Failed to download CEFR data")
        return

    # Process data
    print("Processing CSV content...")
    cefr_dict = process_cefr_data(csv_content)

    if not cefr_dict:
        print("Failed to process CEFR data")
        return

    # Save to JSON
    save_to_json(cefr_dict, OUTPUT_FILE)
    print("Done!")

if __name__ == "__main__":
    main()
