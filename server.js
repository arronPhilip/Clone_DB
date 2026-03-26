// ============================================================
//  PictoPlex — Node.js Express API Server
//
//  BEFORE RUNNING:
//  1. npm init -y
//  2. npm install express mysql2 cors
//  3. Update DB_CONFIG below with your MySQL password
//  4. Move your HTML/CSS/JS files into a public/ folder
//
//  RUN: node server.js
//  OPEN: http://localhost:3000
// ============================================================

const express = require('express')
const mysql   = require('mysql2')
const cors    = require('cors')
const path    = require('path')

const app  = express()
const PORT = 3000

// ── MIDDLEWARE ────────────────────────────────────────────────
app.use(cors())                                    // Allow cross-origin requests
app.use(express.json())                            // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))) // Serve HTML/CSS/JS files

// ── DATABASE CONNECTION ───────────────────────────────────────
const db = mysql.createConnection({
    host:     'localhost',
    user:     'root',
    password: 'root123',    // <-- change this
    database: 'pictoplex'
})

db.connect(err => {
    if (err) {
        console.error('Database connection failed:', err.message)
        process.exit(1)
    }
    console.log('Connected to MySQL database.')
    console.log(`Server running at http://localhost:${PORT}`)
})

// ── HELPER: run a query and return a promise ─────────────────
function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) reject(err)
            else resolve(results)
        })
    })
}

// ============================================================
//  ENDPOINT 1: GET /api/movies
//  Browse movies with optional filters
//
//  Query params:
//    genre      - genre name e.g. ?genre=Action
//    yearFrom   - start year  e.g. ?yearFrom=2000
//    yearTo     - end year    e.g. ?yearTo=2024
//    budgetMin  - min budget in dollars e.g. ?budgetMin=1000000
//    budgetMax  - max budget in dollars
//    revMin     - min revenue in dollars
//    revMax     - max revenue in dollars
//    actor      - actor name  e.g. ?actor=Tom+Hanks
//    director   - director name e.g. ?director=Nolan
//    limit      - max results (default 20)
//    offset     - pagination offset (default 0)
//
//  Example: /api/movies?genre=Action&yearFrom=2010&yearTo=2020
// ============================================================
app.get('/api/movies', async (req, res) => {
    try {
        const {
            genre,
            yearFrom, yearTo,
            budgetMin, budgetMax,
            revMin, revMax,
            actor, director,
            limit  = 20,
            offset = 0
        } = req.query

        // Build dynamic SQL query
        let sql = `
            SELECT DISTINCT
                m.movie_id,
                m.title,
                m.overview,
                m.release_date,
                m.runtime,
                m.budget,
                m.revenue,
                m.poster_path,
                GROUP_CONCAT(DISTINCT g.name ORDER BY g.name SEPARATOR ', ') AS genres
            FROM movie m
            LEFT JOIN movie_genre mg ON m.movie_id = mg.movie_id
            LEFT JOIN genre g        ON mg.genre_id = g.genre_id
        `

        const params = []
        const joins  = []
        const wheres = []

        // Filter by genre
        if (genre) {
            joins.push(`
                JOIN movie_genre mgf ON m.movie_id = mgf.movie_id
                JOIN genre gf        ON mgf.genre_id = gf.genre_id
                    AND gf.name = ?
            `)
            params.push(genre)
        }

        // Filter by actor name
        if (actor) {
            joins.push(`
                JOIN movie_cast mc_filter  ON m.movie_id = mc_filter.movie_id
                JOIN person p_actor        ON mc_filter.person_id = p_actor.person_id
                    AND p_actor.name LIKE ?
            `)
            params.push(`%${actor}%`)
        }

        // Filter by director name
        if (director) {
            joins.push(`
                JOIN movie_director md_filter ON m.movie_id = md_filter.movie_id
                JOIN person p_director        ON md_filter.person_id = p_director.person_id
                    AND p_director.name LIKE ?
            `)
            params.push(`%${director}%`)
        }

        // Add joins to SQL
        sql += joins.join('\n')

        // Add WHERE conditions
        if (yearFrom)  { wheres.push(`YEAR(m.release_date) >= ?`);  params.push(parseInt(yearFrom)) }
        if (yearTo)    { wheres.push(`YEAR(m.release_date) <= ?`);  params.push(parseInt(yearTo)) }
        if (budgetMin) { wheres.push(`m.budget >= ?`);               params.push(parseInt(budgetMin)) }
        if (budgetMax) { wheres.push(`m.budget <= ?`);               params.push(parseInt(budgetMax)) }
        if (revMin)    { wheres.push(`m.revenue >= ?`);              params.push(parseInt(revMin)) }
        if (revMax)    { wheres.push(`m.revenue <= ?`);              params.push(parseInt(revMax)) }

        // Only show released films with a title
        wheres.push(`m.title IS NOT NULL`)
        wheres.push(`m.title != ''`)

        if (wheres.length > 0) {
            sql += ` WHERE ` + wheres.join(' AND ')
        }

        // Group, order and paginate
        sql += ` GROUP BY m.movie_id`
        // Sort
        const sortMap = {
            'revenue':   'm.revenue DESC',
            'budget':    'm.budget DESC',
            'year_desc': 'm.release_date DESC',
            'year_asc':  'm.release_date ASC',
            'title':     'm.title ASC'
        }
        const sortField = sortMap[req.query.sort] || 'm.revenue DESC'
        sql += ` ORDER BY ${sortField}`
        sql += ` LIMIT ? OFFSET ?`
        params.push(parseInt(limit), parseInt(offset))

        const movies = await query(sql, params)

        // Also get total count for pagination
        const countSql = `SELECT COUNT(DISTINCT m.movie_id) AS total FROM movie m
            ${joins.join('\n')}
            ${wheres.length > 0 ? 'WHERE ' + wheres.join(' AND ') : ''}`
        const countResult = await query(countSql, params.slice(0, -2))

        res.json({
            total:  countResult[0].total,
            limit:  parseInt(limit),
            offset: parseInt(offset),
            movies
        })

    } catch (err) {
        console.error('Error in /api/movies:', err.message)
        res.status(500).json({ error: 'Failed to fetch movies' })
    }
})

// ============================================================
//  ENDPOINT 2: GET /api/movies/:id
//  Get full details for a single movie including cast & director
//
//  Example: /api/movies/299536
// ============================================================
app.get('/api/movies/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id)

        // Get movie details
        const movies = await query(
            `SELECT * FROM movie WHERE movie_id = ?`,
            [id]
        )

        if (movies.length === 0) {
            return res.status(404).json({ error: 'Movie not found' })
        }

        const movie = movies[0]

        // Get genres
        const genres = await query(`
            SELECT g.genre_id, g.name
            FROM genre g
            JOIN movie_genre mg ON g.genre_id = mg.genre_id
            WHERE mg.movie_id = ?
            ORDER BY g.name
        `, [id])

        // Get cast (top 10 by billing order)
        const cast = await query(`
            SELECT
                p.person_id,
                p.name,
                p.profile_path,
                mc.character_name,
                mc.cast_order
            FROM movie_cast mc
            JOIN person p ON mc.person_id = p.person_id
            WHERE mc.movie_id = ?
            ORDER BY mc.cast_order ASC
            LIMIT 10
        `, [id])

        // Get director(s)
        const directors = await query(`
            SELECT
                p.person_id,
                p.name,
                p.profile_path
            FROM movie_director md
            JOIN person p ON md.person_id = p.person_id
            WHERE md.movie_id = ?
        `, [id])

        res.json({
            ...movie,
            genres,
            cast,
            directors
        })

    } catch (err) {
        console.error('Error in /api/movies/:id:', err.message)
        res.status(500).json({ error: 'Failed to fetch movie details' })
    }
})

// ============================================================
//  ENDPOINT 3: GET /api/search
//  Search movies by title, or find films by actor/director name
//
//  Query params:
//    q - search term (searches title, actor name, director name)
//
//  Example: /api/search?q=batman
//           /api/search?q=nolan
// ============================================================
app.get('/api/search', async (req, res) => {
    try {
        const q = `%${req.query.q || ''}%`

        const results = await query(`
            SELECT DISTINCT
                m.movie_id,
                m.title,
                m.release_date,
                m.budget,
                m.revenue,
                m.poster_path,
                m.overview
            FROM movie m
            WHERE m.title LIKE ?

            UNION

            SELECT DISTINCT
                m.movie_id,
                m.title,
                m.release_date,
                m.budget,
                m.revenue,
                m.poster_path,
                m.overview
            FROM movie m
            JOIN movie_cast mc ON m.movie_id = mc.movie_id
            JOIN person p      ON mc.person_id = p.person_id
            WHERE p.name LIKE ?

            UNION

            SELECT DISTINCT
                m.movie_id,
                m.title,
                m.release_date,
                m.budget,
                m.revenue,
                m.poster_path,
                m.overview
            FROM movie m
            JOIN movie_director md ON m.movie_id = md.movie_id
            JOIN person p          ON md.person_id = p.person_id
            WHERE p.name LIKE ?

            ORDER BY title ASC
            LIMIT 20
        `, [q, q, q])

        res.json(results)

    } catch (err) {
        console.error('Error in /api/search:', err.message)
        res.status(500).json({ error: 'Search failed' })
    }
})

// ============================================================
//  ENDPOINT 4: GET /api/celebrities
//  Get all actors and directors
//
//  Query params:
//    type   - 'actor' or 'director' (default: both)
//    limit  - max results (default 20)
//    offset - pagination offset
//
//  Example: /api/celebrities?type=actor
// ============================================================
app.get('/api/celebrities', async (req, res) => {
    try {
        const { type, limit = 20, offset = 0 } = req.query

        let actors    = []
        let directors = []

        // Get actors
        if (!type || type === 'actor') {
            actors = await query(`
                SELECT DISTINCT
                    p.person_id,
                    p.name,
                    p.profile_path,
                    'actor' AS role,
                    COUNT(DISTINCT mc.movie_id) AS film_count
                FROM person p
                JOIN movie_cast mc ON p.person_id = mc.person_id
                GROUP BY p.person_id
                ORDER BY film_count DESC
                LIMIT ? OFFSET ?
            `, [parseInt(limit), parseInt(offset)])
        }

        // Get directors
        if (!type || type === 'director') {
            directors = await query(`
                SELECT DISTINCT
                    p.person_id,
                    p.name,
                    p.profile_path,
                    'director' AS role,
                    COUNT(DISTINCT md.movie_id) AS film_count
                FROM person p
                JOIN movie_director md ON p.person_id = md.person_id
                GROUP BY p.person_id
                ORDER BY film_count DESC
                LIMIT ? OFFSET ?
            `, [parseInt(limit), parseInt(offset)])
        }

        res.json({ actors, directors })

    } catch (err) {
        console.error('Error in /api/celebrities:', err.message)
        res.status(500).json({ error: 'Failed to fetch celebrities' })
    }
})

// ============================================================
//  ENDPOINT 5: GET /api/celebrities/:id
//  Get full details for a single person (actor or director)
//  including their full filmography
//
//  Example: /api/celebrities/3223  (Robert Downey Jr.)
// ============================================================
app.get('/api/celebrities/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id)

        // Get person details
        const people = await query(
            `SELECT * FROM person WHERE person_id = ?`,
            [id]
        )

        if (people.length === 0) {
            return res.status(404).json({ error: 'Person not found' })
        }

        const person = people[0]

        // Get films they acted in
        const actedIn = await query(`
            SELECT
                m.movie_id,
                m.title,
                m.release_date,
                m.budget,
                m.revenue,
                m.poster_path,
                mc.character_name,
                mc.cast_order
            FROM movie_cast mc
            JOIN movie m ON mc.movie_id = m.movie_id
            WHERE mc.person_id = ?
            ORDER BY m.release_date DESC
        `, [id])

        // Get films they directed
        const directed = await query(`
            SELECT
                m.movie_id,
                m.title,
                m.release_date,
                m.budget,
                m.revenue,
                m.poster_path
            FROM movie_director md
            JOIN movie m ON md.movie_id = m.movie_id
            WHERE md.person_id = ?
            ORDER BY m.release_date DESC
        `, [id])

        // Determine role
        const role = directed.length > 0 && actedIn.length === 0
            ? 'director'
            : actedIn.length > 0 && directed.length === 0
                ? 'actor'
                : 'both'

        res.json({
            ...person,
            role,
            actedIn,
            directed
        })

    } catch (err) {
        console.error('Error in /api/celebrities/:id:', err.message)
        res.status(500).json({ error: 'Failed to fetch person details' })
    }
})

// ============================================================
//  ENDPOINT 6: GET /api/genres
//  Get all available genres (for filter pills)
//
//  Example: /api/genres
// ============================================================
app.get('/api/genres', async (req, res) => {
    try {
        const genres = await query(
            `SELECT genre_id, name FROM genre ORDER BY name ASC`
        )
        res.json(genres)
    } catch (err) {
        console.error('Error in /api/genres:', err.message)
        res.status(500).json({ error: 'Failed to fetch genres' })
    }
})

// ============================================================
//  START SERVER
// ============================================================
// ── SERVE HOMEPAGE AT ROOT / ─────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'))
})


app.listen(PORT, () => {
    console.log('============================================')
    console.log(`  PictoPlex API running`)
    console.log(`  http://localhost:${PORT}`)
    console.log('============================================')
    console.log('  Endpoints:')
    console.log(`  GET /api/movies`)
    console.log(`  GET /api/movies/:id`)
    console.log(`  GET /api/search?q=...`)
    console.log(`  GET /api/celebrities`)
    console.log(`  GET /api/celebrities/:id`)
    console.log(`  GET /api/genres`)
    console.log('============================================')
})
