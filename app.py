"""
PictoPlex Backend — Flask API (Python)
=======================================
Connects to:
  - TMDB API  → live movie data, posters, cast photos, descriptions
  - MySQL DB  → user accounts, watchlist, ratings

Run:
  pip install -r requirements.txt
  python app.py

Base URL: http://localhost:5000
"""

from flask import Flask, request, jsonify, session
from flask_cors import CORS
import mysql.connector
import requests
import hashlib
import re
from datetime import datetime
from functools import wraps
_people_cache = {"data": None, "time": 0}
app = Flask(__name__)
app.secret_key = "pictoplex_secret_CHANGE_IN_PRODUCTION"
CORS(app, supports_credentials=True,
     origins=["http://127.0.0.1:5500", "http://localhost:5500", "null"])

# ─── TMDB Config ──────────────────────────────────────────────────────────────

TMDB_TOKEN    = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiIyODM1ZmFjZjk2Y2IyN2ViNzVhMmM2OTc1ZWJjNmQwZiIsIm5iZiI6MTc3MzMyMjcyMi42NTYsInN1YiI6IjY5YjJjMWUyYThjNGFjZjVkNWQ0M2M4NSIsInNjb3BlcyI6WyJhcGlfcmVhZCJdLCJ2ZXJzaW9uIjoxfQ.roaYusFKhAi9Q8DodruDTRzsU1O1sbq4NLQxsirH0hQ"
TMDB_BASE     = "https://api.themoviedb.org/3"
TMDB_HEADERS  = {"Authorization": f"Bearer {TMDB_TOKEN}", "Content-Type": "application/json"}

def tmdb(path, params=None):
    resp = requests.get(f"{TMDB_BASE}{path}", headers=TMDB_HEADERS, params=params or {}, timeout=10)
    resp.raise_for_status()
    return resp.json()

def img(path, size="w500"):
    if not path: return None
    sizes = {"w500": "w500", "w780": "w780", "orig": "original"}
    return f"https://image.tmdb.org/t/p/{sizes.get(size,'w500')}{path}"

def fmt_movie(m):
    """Normalise a TMDB movie result for our frontend."""
    return {
        "tmdb_id":      m.get("id"),
        "title":        m.get("title", ""),
        "overview":     m.get("overview", ""),
        "release_date": m.get("release_date", ""),
        "runtime":      m.get("runtime"),
        "rating":       round(float(m.get("vote_average") or 0), 1),
        "vote_count":   m.get("vote_count"),
        "budget":       m.get("budget"),
        "revenue":      m.get("revenue"),
        "poster":       img(m.get("poster_path")),
        "backdrop":     img(m.get("backdrop_path"), "w780"),
        "genres":       [g["name"] for g in m.get("genres", [])],
    }

# ─── DB Config ────────────────────────────────────────────────────────────────

DB_CONFIG = {
    "host": "mudfoot.doc.stu.mmu.ac.uk",
    "port": 6306,
    "user": "moviegroup",
    "password": "RoirEbMy",
    "database": "moviegroup",
}

def db():
    return mysql.connector.connect(**DB_CONFIG)

def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def valid_email(e):
    return bool(re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", e))

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user_id" not in session:
            return jsonify({"error": "Login required"}), 401
        return f(*args, **kwargs)
    return decorated


# ==============================================================================
# AUTH  /api/auth/...
# ==============================================================================

@app.route("/api/auth/register", methods=["POST"])
def register():
    d = request.get_json()
    username = (d.get("username") or "").strip()
    email    = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""

    if not all([username, email, password]):
        return jsonify({"error": "All fields required"}), 400
    if len(username) < 3:
        return jsonify({"error": "Username must be ≥ 3 characters"}), 400
    if not valid_email(email):
        return jsonify({"error": "Invalid email"}), 400
    if len(password) < 6:
        return jsonify({"error": "Password must be ≥ 6 characters"}), 400

    try:
        conn = db(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT UserID FROM UserDetails WHERE Email=%s", (email,))
        if cur.fetchone():
            return jsonify({"error": "Email already registered"}), 409
        cur.execute(
            "INSERT INTO UserDetails (Username,Email,Password,JoinDate) VALUES(%s,%s,%s,%s)",
            (username, email, hash_pw(password), datetime.now().date())
        )
        conn.commit()
        uid = cur.lastrowid
        session["user_id"] = uid
        session["username"] = username
        cur.close(); conn.close()
        return jsonify({"message": "Account created", "user_id": uid, "username": username}), 201
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    d = request.get_json()
    email    = (d.get("email") or "").strip().lower()
    password = d.get("password") or ""
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400
    try:
        conn = db(); cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT UserID,Username FROM UserDetails WHERE Email=%s AND Password=%s",
            (email, hash_pw(password))
        )
        user = cur.fetchone()
        cur.close(); conn.close()
        if not user:
            return jsonify({"error": "Incorrect email or password"}), 401
        session["user_id"]  = user["UserID"]
        session["username"] = user["Username"]
        return jsonify({"message": "Login successful", "user_id": user["UserID"], "username": user["Username"]}), 200
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"message": "Logged out"}), 200


@app.route("/api/auth/user", methods=["GET"])
@login_required
def get_user():
    try:
        conn = db(); cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT UserID,Username,Email,JoinDate FROM UserDetails WHERE UserID=%s",
            (session["user_id"],)
        )
        user = cur.fetchone()
        cur.close(); conn.close()
        if not user:
            session.clear()
            return jsonify({"error": "User not found"}), 404
        return jsonify(user), 200
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# MOVIES  /api/movies/...   — all live from TMDB
# ==============================================================================

@app.route("/api/movies/trending", methods=["GET"])
def trending():
    try:
        data = tmdb("/trending/movie/week")
        return jsonify({
            "movies": [{
                "tmdb_id":      m["id"],
                "title":        m["title"],
                "overview":     m.get("overview", ""),
                "release_date": m.get("release_date", ""),
                "rating":       round(float(m.get("vote_average") or 0), 1),
                "poster":       img(m.get("poster_path")),
                "backdrop":     img(m.get("backdrop_path"), "w780"),
            } for m in data.get("results", [])],
            "total": data.get("total_results", 0)
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/movies/popular", methods=["GET"])
def popular():
    page = request.args.get("page", 1)
    try:
        data = tmdb("/movie/popular", {"page": page})
        return jsonify({
            "movies": [{
                "tmdb_id":      m["id"],
                "title":        m["title"],
                "overview":     m.get("overview", ""),
                "release_date": m.get("release_date", ""),
                "rating":       round(float(m.get("vote_average") or 0), 1),
                "poster":       img(m.get("poster_path")),
                "backdrop":     img(m.get("backdrop_path"), "w780"),
            } for m in data.get("results", [])],
            "page": data.get("page"),
            "total_pages": data.get("total_pages"),
            "total": data.get("total_results"),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/movies/top-rated", methods=["GET"])
def top_rated():
    page = request.args.get("page", 1)
    try:
        data = tmdb("/movie/top_rated", {"page": page})
        return jsonify({
            "movies": [{
                "tmdb_id":      m["id"],
                "title":        m["title"],
                "release_date": m.get("release_date", ""),
                "rating":       round(float(m.get("vote_average") or 0), 1),
                "poster":       img(m.get("poster_path")),
            } for m in data.get("results", [])],
            "page": data.get("page"),
            "total_pages": data.get("total_pages"),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/movies/<int:tmdb_id>", methods=["GET"])
def movie_detail(tmdb_id):
    """
    Full movie detail for movie-detail.html and actors-director.html.
    Returns: info, cast (top 10), director(s), trailer URL, similar movies.
    """
    try:
        details = tmdb(f"/movie/{tmdb_id}")
        credits = tmdb(f"/movie/{tmdb_id}/credits")
        videos  = tmdb(f"/movie/{tmdb_id}/videos")
        similar = tmdb(f"/movie/{tmdb_id}/similar")

        trailer = next(
            (v for v in videos.get("results", [])
             if v.get("type") == "Trailer" and v.get("site") == "YouTube"),
            None
        )

        return jsonify({
            **fmt_movie(details),
            "cast": [{
                "person_id":      c["id"],
                "name":           c["name"],
                "character_name": c.get("character", ""),
                "cast_order":     c.get("order", 0),
                "photo":          img(c.get("profile_path")),
            } for c in credits.get("cast", [])[:10]],

            "directors": [{
                "person_id": p["id"],
                "name":      p["name"],
                "photo":     img(p.get("profile_path")),
            } for p in credits.get("crew", []) if p.get("job") == "Director"],

            "trailer_key": trailer["key"] if trailer else None,
            "trailer_url": f"https://www.youtube.com/watch?v={trailer['key']}" if trailer else None,

            "similar": [{
                "tmdb_id": m["id"],
                "title":   m["title"],
                "poster":  img(m.get("poster_path")),
                "rating":  round(float(m.get("vote_average") or 0), 1),
            } for m in similar.get("results", [])[:5]],
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/search", methods=["GET"])
def search():
    q    = (request.args.get("q") or "").strip()
    page = request.args.get("page", 1)
    if not q:
        return jsonify({"error": "Query (q) required"}), 400
    try:
        data = tmdb("/search/movie", {"query": q, "page": page})
        return jsonify({
            "results": [{
                "tmdb_id":      m["id"],
                "title":        m["title"],
                "overview":     m.get("overview", ""),
                "release_date": m.get("release_date", ""),
                "rating":       round(float(m.get("vote_average") or 0), 1),
                "poster":       img(m.get("poster_path")),
            } for m in data.get("results", [])],
            "total": data.get("total_results"),
            "pages": data.get("total_pages"),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/genres", methods=["GET"])
def genres():
    try:
        data = tmdb("/genre/movie/list")
        return jsonify(data.get("genres", [])), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/movies/genre/<int:genre_id>", methods=["GET"])
def by_genre(genre_id):
    page = request.args.get("page", 1)
    try:
        data = tmdb("/discover/movie", {"with_genres": genre_id, "page": page, "sort_by": "popularity.desc"})
        return jsonify({
            "movies": [{
                "tmdb_id":      m["id"],
                "title":        m["title"],
                "release_date": m.get("release_date", ""),
                "rating":       round(float(m.get("vote_average") or 0), 1),
                "poster":       img(m.get("poster_path")),
            } for m in data.get("results", [])],
            "page": data.get("page"),
            "total_pages": data.get("total_pages"),
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@app.route("/api/movies/discover", methods=["GET"])
def discover():
    """
    Unified browse endpoint.
    Budget/revenue inputs are in $B (0.5 = $500M, 2 = $2B).
    When budget/revenue filters are active, fetches multiple pages of details
    in parallel until we collect at least 20 matching movies.
    """
    from concurrent.futures import ThreadPoolExecutor

    page        = int(request.args.get("page", 1))
    year_from   = request.args.get("year_from", "")
    year_to     = request.args.get("year_to", "")
    genres      = request.args.get("genres", "")
    sort_by     = request.args.get("sort_by", "popularity.desc")
    budget_min  = request.args.get("budget_min", "")
    budget_max  = request.args.get("budget_max", "")
    revenue_min = request.args.get("revenue_min", "")
    revenue_max = request.args.get("revenue_max", "")

    need_details = any([budget_min, budget_max, revenue_min, revenue_max])

    B = 1_000_000_000
    try:
        bmin = float(budget_min)  * B if budget_min  else 0
        bmax = float(budget_max)  * B if budget_max  else float("inf")
        rmin = float(revenue_min) * B if revenue_min else 0
        rmax = float(revenue_max) * B if revenue_max else float("inf")
    except Exception:
        bmin, bmax, rmin, rmax = 0, float("inf"), 0, float("inf")

    def build_params(p):
        params = {"page": p, "sort_by": sort_by}
        if genres:    params["with_genres"] = genres
        if year_from: params["primary_release_date.gte"] = f"{year_from}-01-01"
        if year_to:   params["primary_release_date.lte"] = f"{year_to}-12-31"
        return params

    try:
        genres_data = tmdb("/genre/movie/list")
        genre_map   = {g["id"]: g["name"] for g in genres_data.get("genres", [])}

        if not need_details:
            # Fast path — no budget/revenue filter needed
            data = tmdb("/discover/movie", build_params(page))
            movies = [{
                "tmdb_id":      m["id"],
                "title":        m["title"],
                "overview":     m.get("overview", ""),
                "release_date": m.get("release_date", ""),
                "rating":       round(float(m.get("vote_average") or 0), 1),
                "poster":       img(m.get("poster_path")),
                "genres":       [genre_map.get(gid, "") for gid in m.get("genre_ids", [])[:3]],
                "budget":       0,
                "revenue":      0,
            } for m in data.get("results", [])]
            return jsonify({
                "movies":      movies,
                "page":        data.get("page"),
                "total_pages": data.get("total_pages"),
                "total":       data.get("total_results"),
            }), 200

        # Slow path — need budget/revenue data, fetch details in parallel
        # Scan up to 5 pages of results to collect 20 matching movies
        TARGET      = 20
        MAX_PAGES   = 5
        collected   = []
        total_pages = 1

        def fetch_detail(m):
            try:
                d = tmdb(f"/movie/{m['id']}")
                budget  = d.get("budget")  or 0
                revenue = d.get("revenue") or 0
                if not (bmin <= budget <= bmax and rmin <= revenue <= rmax):
                    return None
                return {
                    "tmdb_id":      m["id"],
                    "title":        m["title"],
                    "overview":     m.get("overview", ""),
                    "release_date": m.get("release_date", ""),
                    "rating":       round(float(m.get("vote_average") or 0), 1),
                    "poster":       img(m.get("poster_path")),
                    "genres":       [genre_map.get(gid, "") for gid in m.get("genre_ids", [])[:3]],
                    "budget":       budget,
                    "revenue":      revenue,
                }
            except Exception:
                return None

        # Determine which real pages to scan based on virtual page number
        # Each virtual page shows 20 results, we scan up to 5 TMDB pages per virtual page
        start_page = (page - 1) * MAX_PAGES + 1

        with ThreadPoolExecutor(max_workers=20) as ex:
            for tmdb_page in range(start_page, start_page + MAX_PAGES):
                if len(collected) >= TARGET:
                    break
                data = tmdb("/discover/movie", build_params(tmdb_page))
                total_pages = max(total_pages, data.get("total_pages", 1))
                results = data.get("results", [])
                if not results:
                    break
                details = [r for r in ex.map(fetch_detail, results) if r]
                collected.extend(details)

        # Virtual pagination
        virtual_total = max(1, total_pages // MAX_PAGES)
        return jsonify({
            "movies":      collected[:TARGET],
            "page":        page,
            "total_pages": virtual_total,
            "total":       len(collected),
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# CELEBRITIES  /api/person/...   — from TMDB
# ==============================================================================

@app.route("/api/person/popular", methods=["GET"])
def popular_people():
    import time
    if _people_cache["data"] and time.time() - _people_cache["time"] < 3600:
        return jsonify(_people_cache["data"]), 200
    try:
        from concurrent.futures import ThreadPoolExecutor

        def fetch_actor_page(p):
            return tmdb("/person/popular", {"page": p}).get("results", [])

        with ThreadPoolExecutor(max_workers=5) as ex:
            pages = list(ex.map(fetch_actor_page, range(1, 6)))
        actors_data = [p for page in pages for p in page]
        actors = [{
            "person_id":  p["id"],
            "name":       p["name"],
            "department": "Acting",
            "photo":      img(p.get("profile_path")),
            "known_for":  [m.get("title","") for m in p.get("known_for", [])[:3]],
        } for p in actors_data]

        popular_movies = tmdb("/movie/popular", {"page": 1}).get("results", [])[:10]
        director_ids = set()
        directors = []

        def fetch_credits(movie):
            try:
                credits = tmdb(f"/movie/{movie['id']}/credits")
                return [(p, movie) for p in credits.get("crew", []) if p.get("job") == "Director"]
            except Exception:
                return []

        with ThreadPoolExecutor(max_workers=10) as ex:
            all_credits = list(ex.map(fetch_credits, popular_movies))

        for crew_list in all_credits:
            for p, movie in crew_list:
                if p["id"] not in director_ids:
                    director_ids.add(p["id"])
                    directors.append({
                        "person_id":  p["id"],
                        "name":       p["name"],
                        "department": "Directing",
                        "photo":      img(p.get("profile_path")),
                        "known_for":  [movie.get("title", "")],
                    })

        result = actors + directors
        _people_cache["data"] = result
        _people_cache["time"] = time.time()
        return jsonify(result), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/person/search", methods=["GET"])
def person_search():
    q = (request.args.get("q") or "").strip()
    if not q:
        return jsonify({"error": "Query (q) required"}), 400
    try:
        data = tmdb("/search/person", {"query": q})
        return jsonify([{
            "person_id":  p["id"],
            "name":       p["name"],
            "department": p.get("known_for_department"),
            "photo":      img(p.get("profile_path")),
            "known_for":  [m.get("title","") for m in p.get("known_for", [])[:3]],
        } for p in data.get("results", [])[:12]]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/person/<int:person_id>", methods=["GET"])
def person_detail(person_id):
    """
    Celebrity detail — used by celebrity-detail.html and celebrity-detail-director.html.
    Returns bio, photo, known_for_department (Actor/Director), top filmography.
    """
    try:
        details = tmdb(f"/person/{person_id}")
        credits = tmdb(f"/person/{person_id}/movie_credits")

        # Combine cast + crew, sort by popularity, deduplicate
        all_films = credits.get("cast", []) + credits.get("crew", [])
        all_films.sort(key=lambda x: x.get("popularity", 0), reverse=True)
        seen, top = set(), []
        for f in all_films:
            if f["id"] not in seen:
                seen.add(f["id"])
                top.append({
                    "tmdb_id":   f["id"],
                    "title":     f.get("title", ""),
                    "year":      (f.get("release_date") or "")[:4],
                    "poster":    img(f.get("poster_path")),
                    "character": f.get("character", ""),
                    "job":       f.get("job", ""),
                })

        return jsonify({
            "person_id":    details["id"],
            "name":         details["name"],
            "birthday":     details.get("birthday"),
            "birthplace":   details.get("place_of_birth"),
            "biography":    details.get("biography"),
            "department":   details.get("known_for_department"),
            "photo":        img(details.get("profile_path")),
            "total_films":  len(set(f["id"] for f in all_films)),
            "filmography":  top,
        }), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# WATCHLIST  /api/watchlist/...   — stored in MySQL, enriched from TMDB
# ==============================================================================

@app.route("/api/watchlist", methods=["GET"])
@login_required
def get_watchlist():
    try:
        conn = db(); cur = conn.cursor(dictionary=True)
        cur.execute(
            "SELECT WatchlistID,MovieID,DateAdded FROM Watchlist WHERE UserID=%s ORDER BY DateAdded DESC",
            (session["user_id"],)
        )
        rows = cur.fetchall()
        cur.close(); conn.close()

        enriched = []
        for row in rows:
            try:
                m = tmdb(f"/movie/{row['MovieID']}")
                enriched.append({
                    "watchlist_id": row["WatchlistID"],
                    "date_added":   str(row["DateAdded"]),
                    "tmdb_id":      m["id"],
                    "title":        m["title"],
                    "overview":     m.get("overview", ""),
                    "release_date": m.get("release_date", ""),
                    "rating":       round(float(m.get("vote_average") or 0), 1),
                    "poster":       img(m.get("poster_path")),
                })
            except Exception:
                enriched.append({"watchlist_id": row["WatchlistID"], "tmdb_id": row["MovieID"], "title": "Unknown"})

        return jsonify(enriched), 200
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/watchlist", methods=["POST"])
@login_required
def add_watchlist():
    tmdb_id = (request.get_json() or {}).get("tmdb_id")
    if not tmdb_id:
        return jsonify({"error": "tmdb_id required"}), 400
    try:
        tmdb(f"/movie/{tmdb_id}")  # verify movie exists
    except Exception:
        return jsonify({"error": "Movie not found on TMDB"}), 404
    try:
        conn = db(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT WatchlistID FROM Watchlist WHERE UserID=%s AND MovieID=%s",
                    (session["user_id"], tmdb_id))
        if cur.fetchone():
            return jsonify({"error": "Already in watchlist"}), 409
        cur.execute("INSERT INTO Watchlist(UserID,MovieID,DateAdded) VALUES(%s,%s,%s)",
                    (session["user_id"], tmdb_id, datetime.now().date()))
        conn.commit()
        wid = cur.lastrowid
        cur.close(); conn.close()
        return jsonify({"message": "Added to watchlist", "watchlist_id": wid}), 201
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/watchlist/<int:wid>", methods=["DELETE"])
@login_required
def remove_watchlist(wid):
    try:
        conn = db(); cur = conn.cursor()
        cur.execute("DELETE FROM Watchlist WHERE WatchlistID=%s AND UserID=%s",
                    (wid, session["user_id"]))
        conn.commit()
        affected = cur.rowcount
        cur.close(); conn.close()
        if affected == 0:
            return jsonify({"error": "Not found in your watchlist"}), 404
        return jsonify({"message": "Removed"}), 200
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# RATINGS  /api/ratings/...   — stored in MySQL
# ==============================================================================

@app.route("/api/ratings/<int:tmdb_id>", methods=["GET"])
def get_ratings(tmdb_id):
    try:
        conn = db(); cur = conn.cursor(dictionary=True)
        cur.execute("SELECT AVG(Score) AS avg_score, COUNT(*) AS total FROM Ratings WHERE MovieID=%s", (tmdb_id,))
        row = cur.fetchone()
        cur.close(); conn.close()
        return jsonify({
            "tmdb_id":   tmdb_id,
            "avg_score": round(float(row["avg_score"]), 1) if row["avg_score"] else None,
            "total":     row["total"],
        }), 200
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ratings", methods=["POST"])
@login_required
def post_rating():
    d = request.get_json() or {}
    tmdb_id = d.get("tmdb_id")
    score   = d.get("score")
    if not tmdb_id or score is None:
        return jsonify({"error": "tmdb_id and score required"}), 400
    if not (1 <= float(score) <= 10):
        return jsonify({"error": "Score must be 1–10"}), 400
    try:
        conn = db(); cur = conn.cursor()
        cur.execute(
            """INSERT INTO Ratings(UserID,MovieID,Score,RatingDate) VALUES(%s,%s,%s,%s)
               ON DUPLICATE KEY UPDATE Score=%s, RatingDate=%s""",
            (session["user_id"], tmdb_id, score, datetime.now().date(),
             score, datetime.now().date())
        )
        conn.commit()
        cur.close(); conn.close()
        return jsonify({"message": "Rating saved"}), 200
    except mysql.connector.Error as e:
        return jsonify({"error": str(e)}), 500


# ==============================================================================
# HEALTH CHECK  /api/health
# ==============================================================================

@app.route("/api/health", methods=["GET"])
def health():
    result = {}
    try:
        tmdb("/configuration")
        result["tmdb"] = "ok"
    except Exception as e:
        result["tmdb"] = str(e)
    try:
        conn = db(); conn.ping(); conn.close()
        result["db"] = "ok"
    except Exception as e:
        result["db"] = str(e)
    ok = all(v == "ok" for v in result.values())
    return jsonify({"status": "ok" if ok else "degraded", **result}), 200 if ok else 500


if __name__ == "__main__":
    print("🎬 PictoPlex API → http://localhost:5000")
    app.run(debug=True, port=5000)