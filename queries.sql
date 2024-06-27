CREATE TABLE textbooks(
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    author VARCHAR(100),
    isbn VARCHAR(50),
    rating INTEGER,
    numratings INTEGER,
    category VARCHAR(100),
    level VARCHAR(100),
    summary TEXT
);


INSERT INTO textbooks (name, author, isbn, rating, numratings, category, level, summary)
VALUES ('Electricity and Magnetism', 'Edward Purcell and David Morin', '9781107014022', 5, 1, 'Physics', 'Advanced', 'Sample summary');