import bodyParser from "body-parser";
import express from "express";
import pg from "pg";

const port = 3000;
const app = express();
const db = new pg.Client({
  user: "postgres",
  host: "",
  database: "textbook", // Textbook for local
  password: "", // Enter PostgreSQL password here
  port: 5432
});

let category = "Any";
let sort = 'rating';
let order = 'DESC';
let level = "Any";

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", async (req, res) => {
    let textbooks;
    let query;
    try{
        if(category == "Any"){
            if(level == "Any"){
                query = `SELECT * FROM textbooks ORDER BY ${sort} ${order};`
            }
            else{
                query = `SELECT * FROM textbooks WHERE level='${level}' ORDER BY ${sort} ${order};`
            }         
        }
        else{
            if(level=="Any"){
                query = `SELECT * FROM textbooks WHERE category='${category}' ORDER BY ${sort} ${order};`;
            }
            else{
                query = `SELECT * FROM textbooks WHERE category='${category}' AND level='${level}' ORDER BY ${sort} ${order};`;
            }      
        }
        textbooks = await db.query(query);
        res.render("index.ejs", {textbooks: textbooks.rows});
    } catch(error){
        console.log(error);
    }
});

app.get("/add", (req, res) => {
    res.render("add.ejs");
});

app.get("/books/:bookName", async (req, res) => {
    const name_and_author = req.params.bookName.split(' by ');
    const bookName = name_and_author[0];
    const author = name_and_author[1];
    const textbook = await db.query('SELECT * FROM textbooks WHERE name=$1 AND author=$2', [bookName, author]);
    res.render("textbook.ejs", {textbook: textbook.rows[0]});
});

app.get("/back", (req, res) => {
   res.redirect("/"); 
});

app.post("/filter", (req, res) => {
    category = req.body.category;
    level = req.body.level;
    sort = req.body.sort;
    order = req.body.order;
    res.redirect("/");
});

app.post("/addtextbook", async (req, res) => {
    let name = req.body.name;
    let author = req.body.author;
    let isbn = req.body.isbn;
    let rating;
    try{
        rating = Number(req.body.rating);
    } catch (error){
        console.log("Please enter an integer (eg. 4) for the rating!");
    }
    let category = req.body.category;
    let level = req.body.level;
    let summary = req.body.summary;
    await db.query("INSERT INTO textbooks (name, author, isbn, rating, numratings, category, level, summary) VALUES ($1, $2, $3, $4, 1, $5, $6, $7)", [name, author, isbn, rating, category, level, summary]);
    res.redirect("/");
})

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
