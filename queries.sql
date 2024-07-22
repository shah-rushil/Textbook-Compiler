CREATE TABLE textbooks(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    author VARCHAR(100),
    isbn VARCHAR(50),
    rating FLOAT,
    numratings INTEGER,
    category VARCHAR(100),
    level VARCHAR(100),
    summary TEXT
);


INSERT INTO textbooks (name, author, isbn, rating, numratings, category, level, summary)
VALUES ('Electricity and Magnetism', 'Edward Purcell and David Morin', '9781107014022', 5, 1, 'Physics', 'Advanced', 'Sample summary');

CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE,
    password TEXT,
    email VARCHAR(100) UNIQUE,
    verified BOOLEAN
);

CREATE TABLE ratings(
    id SERIAL PRIMARY KEY,
    username VARCHAR(100),
    textbookid INTEGER,
    stars INTEGER,
    rating TEXT,
    anonymous BOOLEAN
);