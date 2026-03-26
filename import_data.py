# ============================================================
#  PictoPlex — Python Data Import Script
#  Reads Kaggle CSVs, cleans the data, inserts into MySQL
#
#  BEFORE RUNNING:
#  1. pip install pandas mysql-connector-python
#  2. Make sure MySQL is running and pictoplex database exists
#  3. Put movies_metadata.csv and credits.csv in same folder
#  4. Update DB_CONFIG below with your MySQL password
#
#  RUN: python import_data.py
# ============================================================

import pandas as pd
import ast
import mysql.connector
from mysql.connector import Error
import sys

# ── DATABASE CONFIG ──────────────────────────────────────────
DB_CONFIG = {
    'host':     'localhost',
    'user':     'root',
    'password': 'root123',   # <-- change this
    'database': 'pictoplex'
}

# ── HELPER: safely parse JSON-like columns ───────────────────
def safe_parse(val):
    """
    The Kaggle dataset stores lists as Python-style strings
    e.g. "[{'id': 28, 'name': 'Action'}, ...]"
    ast.literal_eval converts them back to real Python objects.
    Returns empty list if parsing fails.
    """
    try:
        return ast.literal_eval(str(val))
    except:
        return []

# ── HELPER: safely convert to int ────────────────────────────
def safe_int(val):
    try:
        v = int(float(str(val)))
        return v if v > 0 else 0
    except:
        return 0

# ── HELPER: safely convert date ──────────────────────────────
def safe_date(val):
    try:
        d = pd.to_datetime(val)
        return d.strftime('%Y-%m-%d')
    except:
        return None

# ── CONNECT TO MYSQL ─────────────────────────────────────────
print("Connecting to MySQL...")
try:
    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor()
    print("Connected successfully.\n")
except Error as e:
    print(f"Connection failed: {e}")
    sys.exit(1)

# ── READ CSV FILES ────────────────────────────────────────────
print("Reading CSV files...")
try:
    movies_df  = pd.read_csv('movies_metadata.csv', low_memory=False)
    credits_df = pd.read_csv('credits.csv')
    print(f"Loaded {len(movies_df)} movies and {len(credits_df)} credit rows.\n")
except FileNotFoundError as e:
    print(f"CSV file not found: {e}")
    print("Make sure movies_metadata.csv and credits.csv are in the same folder.")
    sys.exit(1)

# ── CLEAN MOVIES DATA ─────────────────────────────────────────
# Remove rows with bad/non-numeric IDs
movies_df = movies_df[pd.to_numeric(movies_df['id'], errors='coerce').notna()]
movies_df['id'] = movies_df['id'].astype(int)

# ── STEP 1: INSERT MOVIES & GENRES ───────────────────────────
print("Inserting movies and genres...")

inserted_movies  = 0
inserted_genres  = 0
skipped_movies   = 0
seen_genres      = {}  # genre_id -> genre_name (avoid duplicates)

for _, row in movies_df.iterrows():

    movie_id = safe_int(row['id'])
    if movie_id == 0:
        skipped_movies += 1
        continue

    title        = str(row.get('title', ''))[:500]
    overview     = str(row.get('overview', ''))
    release_date = safe_date(row.get('release_date'))
    runtime      = safe_int(row.get('runtime'))
    budget       = safe_int(row.get('budget'))
    revenue      = safe_int(row.get('revenue'))
    poster_path  = str(row.get('poster_path', ''))[:500] if pd.notna(row.get('poster_path')) else None

    # Skip movies with no title
    if not title or title == 'nan':
        skipped_movies += 1
        continue

    # Insert into movie table (ignore duplicates)
    try:
        cursor.execute("""
            INSERT IGNORE INTO movie
                (movie_id, title, overview, release_date, runtime, budget, revenue, poster_path)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (movie_id, title, overview, release_date, runtime, budget, revenue, poster_path))
        inserted_movies += 1
    except Error as e:
        skipped_movies += 1
        continue

    # Parse and insert genres
    genres = safe_parse(row.get('genres'))
    for g in genres:
        g_id   = safe_int(g.get('id'))
        g_name = str(g.get('name', ''))[:100]

        if g_id == 0 or not g_name:
            continue

        # Insert genre if not seen before
        if g_id not in seen_genres:
            try:
                cursor.execute("""
                    INSERT IGNORE INTO genre (genre_id, name) VALUES (%s, %s)
                """, (g_id, g_name))
                seen_genres[g_id] = g_name
                inserted_genres += 1
            except Error:
                pass

        # Link movie to genre
        try:
            cursor.execute("""
                INSERT IGNORE INTO movie_genre (movie_id, genre_id) VALUES (%s, %s)
            """, (movie_id, g_id))
        except Error:
            pass

# Commit after movies + genres
conn.commit()
print(f"Movies inserted: {inserted_movies} | Skipped: {skipped_movies}")
print(f"Genres inserted: {inserted_genres}\n")

# ── STEP 2: INSERT PEOPLE (CAST & DIRECTORS) ─────────────────
print("Inserting cast and directors...")

inserted_people    = 0
inserted_cast      = 0
inserted_directors = 0
seen_people        = set()  # person_ids already inserted

# Merge credits with movies so we have the movie_id
credits_df['id'] = pd.to_numeric(credits_df['id'], errors='coerce')
credits_df = credits_df.dropna(subset=['id'])
credits_df['id'] = credits_df['id'].astype(int)

for _, row in credits_df.iterrows():

    movie_id = safe_int(row['id'])
    if movie_id == 0:
        continue

    # ── CAST (actors) ──────────────────────────
    cast_list = safe_parse(row.get('cast'))

    # Only take top 10 billed actors
    for actor in cast_list[:10]:
        person_id  = safe_int(actor.get('id'))
        name       = str(actor.get('name', ''))[:300]
        char_name  = str(actor.get('character', ''))[:500]
        order      = safe_int(actor.get('order'))
        profile    = str(actor.get('profile_path', ''))[:500] if actor.get('profile_path') else None

        if person_id == 0 or not name or name == 'nan':
            continue

        # Insert person once
        if person_id not in seen_people:
            try:
                cursor.execute("""
                    INSERT IGNORE INTO person (person_id, name, profile_path)
                    VALUES (%s, %s, %s)
                """, (person_id, name, profile))
                seen_people.add(person_id)
                inserted_people += 1
            except Error:
                pass

        # Link actor to movie
        try:
            cursor.execute("""
                INSERT IGNORE INTO movie_cast (movie_id, person_id, character_name, cast_order)
                VALUES (%s, %s, %s, %s)
            """, (movie_id, person_id, char_name, order))
            inserted_cast += 1
        except Error:
            pass

    # ── CREW (directors only) ──────────────────
    crew_list = safe_parse(row.get('crew'))

    for member in crew_list:
        if str(member.get('job', '')) != 'Director':
            continue

        person_id = safe_int(member.get('id'))
        name      = str(member.get('name', ''))[:300]
        profile   = str(member.get('profile_path', ''))[:500] if member.get('profile_path') else None

        if person_id == 0 or not name or name == 'nan':
            continue

        # Insert person once
        if person_id not in seen_people:
            try:
                cursor.execute("""
                    INSERT IGNORE INTO person (person_id, name, profile_path)
                    VALUES (%s, %s, %s)
                """, (person_id, name, profile))
                seen_people.add(person_id)
                inserted_people += 1
            except Error:
                pass

        # Link director to movie
        try:
            cursor.execute("""
                INSERT IGNORE INTO movie_director (movie_id, person_id)
                VALUES (%s, %s)
            """, (movie_id, person_id))
            inserted_directors += 1
        except Error:
            pass

    # Commit every 1000 rows to avoid memory issues
    if _ % 1000 == 0:
        conn.commit()
        print(f"  Progress: {_} rows processed...")

# Final commit
conn.commit()
print(f"People inserted:    {inserted_people}")
print(f"Cast links:         {inserted_cast}")
print(f"Director links:     {inserted_directors}\n")

# ── DONE ─────────────────────────────────────────────────────
cursor.close()
conn.close()

print("=" * 50)
print("Import complete! Your database is ready.")
print("=" * 50)
print("\nVerify in MySQL Workbench:")
print("  SELECT COUNT(*) FROM movie;")
print("  SELECT COUNT(*) FROM person;")
print("  SELECT COUNT(*) FROM movie_cast;")
