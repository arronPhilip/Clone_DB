-- ============================================================
--  PictoPlex — MySQL Database Schema
--  Run this file in MySQL Workbench to create all tables
--  Database: pictoplex
-- ============================================================

-- Create and select the database
CREATE DATABASE IF NOT EXISTS pictoplex;
USE pictoplex;

-- ============================================================
--  TABLE 1: movie
--  Stores all core movie information
--  Source: movies_metadata.csv
-- ============================================================
CREATE TABLE IF NOT EXISTS movie (
    movie_id      INT PRIMARY KEY,           -- TMDB movie ID (from 'id' column)
    title         VARCHAR(500) NOT NULL,     -- Movie title
    overview      TEXT,                      -- Plot description
    release_date  DATE,                      -- Release date (YYYY-MM-DD)
    runtime       INT,                       -- Runtime in minutes
    budget        BIGINT DEFAULT 0,          -- Budget in USD
    revenue       BIGINT DEFAULT 0,          -- Revenue in USD
    poster_path   VARCHAR(500)               -- Path to poster e.g. /abc123.jpg
);

-- ============================================================
--  TABLE 2: genre
--  Stores unique genre names
--  Source: parsed from movies_metadata.csv 'genres' column
-- ============================================================
CREATE TABLE IF NOT EXISTS genre (
    genre_id   INT PRIMARY KEY,              -- TMDB genre ID
    name       VARCHAR(100) NOT NULL UNIQUE  -- Genre name e.g. 'Action'
);

-- ============================================================
--  TABLE 3: movie_genre
--  Links movies to genres (many-to-many)
--  One movie can have multiple genres e.g. Action + Sci-Fi
-- ============================================================
CREATE TABLE IF NOT EXISTS movie_genre (
    movie_id   INT NOT NULL,
    genre_id   INT NOT NULL,
    PRIMARY KEY (movie_id, genre_id),
    FOREIGN KEY (movie_id) REFERENCES movie(movie_id)   ON DELETE CASCADE,
    FOREIGN KEY (genre_id) REFERENCES genre(genre_id)   ON DELETE CASCADE
);

-- ============================================================
--  TABLE 4: person
--  Stores all people — both actors AND directors
--  Source: parsed from credits.csv 'cast' and 'crew' columns
-- ============================================================
CREATE TABLE IF NOT EXISTS person (
    person_id    INT PRIMARY KEY,            -- TMDB person ID
    name         VARCHAR(300) NOT NULL,      -- Full name e.g. 'Robert Downey Jr.'
    profile_path VARCHAR(500)                -- Path to profile photo
);

-- ============================================================
--  TABLE 5: movie_cast
--  Links actors to movies with their character name
--  Only stores top 10 billed actors per film
-- ============================================================
CREATE TABLE IF NOT EXISTS movie_cast (
    cast_id        INT AUTO_INCREMENT PRIMARY KEY,
    movie_id       INT NOT NULL,
    person_id      INT NOT NULL,
    character_name VARCHAR(500),             -- Character name e.g. 'Iron Man'
    cast_order     INT,                      -- Billing order (0 = top billed)
    FOREIGN KEY (movie_id)  REFERENCES movie(movie_id)   ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES person(person_id) ON DELETE CASCADE
);

-- ============================================================
--  TABLE 6: movie_director
--  Links directors to movies
--  Extracted from credits.csv 'crew' where job = 'Director'
-- ============================================================
CREATE TABLE IF NOT EXISTS movie_director (
    director_id  INT AUTO_INCREMENT PRIMARY KEY,
    movie_id     INT NOT NULL,
    person_id    INT NOT NULL,
    FOREIGN KEY (movie_id)  REFERENCES movie(movie_id)   ON DELETE CASCADE,
    FOREIGN KEY (person_id) REFERENCES person(person_id) ON DELETE CASCADE
);

-- ============================================================
--  INDEXES — speed up common filter/search queries
-- ============================================================
CREATE INDEX idx_movie_release   ON movie(release_date);
CREATE INDEX idx_movie_budget    ON movie(budget);
CREATE INDEX idx_movie_revenue   ON movie(revenue);
CREATE INDEX idx_movie_title     ON movie(title);
CREATE INDEX idx_person_name     ON person(name);
CREATE INDEX idx_cast_order      ON movie_cast(cast_order);
CREATE INDEX idx_cast_movie      ON movie_cast(movie_id);
CREATE INDEX idx_director_movie  ON movie_director(movie_id);

-- ============================================================
--  VERIFY — run these to check tables were created correctly
-- ============================================================
-- SHOW TABLES;
-- DESCRIBE movie;
-- DESCRIBE genre;
-- DESCRIBE movie_genre;
-- DESCRIBE person;
-- DESCRIBE movie_cast;
-- DESCRIBE movie_director;
