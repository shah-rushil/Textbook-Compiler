import bodyParser from "body-parser";
import express from "express";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import {Strategy} from "passport-local";
import env from "dotenv";

const port = 3000;
const app = express();
const saltRounds = 5; // Encrypt
env.config();

const db = new pg.Client({
  user: "postgres",
  host: process.env.DATABASE_HOST, // Enter EC2 end link Encrypt
  database: "Textbook", // Textbook for local
  password: process.env.DATABASE_PASSWORD, // Encrypt
  port: 5432
});

let category = "Any";
let sort = 'rating';
let order = 'DESC';
let level = "Any";

db.connect();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));

app.use(passport.initialize());
app.use(passport.session());

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
        if(req.isAuthenticated()){
            const username = req.user.username;
            res.render("index.ejs", {textbooks: textbooks.rows, username: username});
        } else {
            res.render("index.ejs", {textbooks: textbooks.rows});
        }
        
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
    if(req.isAuthenticated()){
        const username = req.user.username;
        const ratings = await db.query('SELECT * FROM ratings WHERE username=$1 AND textbookid=$2', [username, textbook.rows[0].id]);
        res.render("textbook.ejs", {textbook: textbook.rows[0], username: username, ratings: ratings.rows});
    } else {
        res.render("textbook.ejs", {textbook: textbook.rows[0]});
    }
});

app.get("/back", (req, res) => {
   res.redirect("/"); 
});

app.get("/signin", (req, res) => {
    res.render("signin.ejs");
})

app.get("/signout", (req, res) => {
   req.logout(function(err) {
    if (err) {
      console.error('Error logging out:', err);
      return next(err);
    }
    res.redirect('/');
  });
});

app.get("/createaccount", (req, res) => {
    res.render("createaccount.ejs");
})

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
        rating = parseInt(req.body.rating);
    } catch (error){
        console.log("Please enter an integer (eg. 4) for the rating!");
    }
    let category = req.body.category;
    let level = req.body.level;
    let summary = req.body.summary;
    await db.query("INSERT INTO textbooks (name, author, isbn, rating, numratings, category, level, summary) VALUES ($1, $2, $3, $4, 1, $5, $6, $7);", [name, author, isbn, rating, category, level, summary]);
    res.redirect("/");
})

app.post("/rating", async (req, res) => {
    let username = req.user.username;
    let textbookid = req.user.username;
    let stars = req.body.level;
    let rating = req.body.summary;
    await db.query("INSERT INTO ratings (username, textbookid, stars, rating) VALUES ($1, $2, $3, $4);", [username, textbookid, stars, rating]);
    res.redirect("/");
});

app.post("/signin", passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/signin"
}));

app.post("/createaccount", async (req, res) => {
    const username = req.body.username;
    const password = req.body.password;
    const email = req.body.email;

    try{
        const checkResult = await db.query("SELECT * FROM users WHERE email = $1", [email]);
        const checkResult2 = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if(checkResult.rows.length > 0){
            res.send("Email already exists. Try logging in.");
        }
        else if(checkResult2.rows.length > 0){
            res.send("Username already exists. Try a new username.");
        }
        else{
            // Encrypt Password
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if(err){
                    console.log(err);
                }
                else{
                    const result = await db.query("INSERT INTO users (username, password, email) VALUES ($1, $2, $3) RETURNING *", [username, hash, email]);
                    const user = result.rows[0];
                    req.login(user, (err) => {
                        console.log(err);
                        res.redirect("/");
                    })
                }
            });
        }
    }catch(err) {
        console.log(err);
    }
});

passport.use(new Strategy(async function verify(username, password, cb) {
    try{
        const checkResult = await db.query("SELECT * FROM users WHERE username = $1", [username]);
        if(checkResult.rows.length == 0){
            return cb("User not found");
        }
        else{
            // Encrypt Password
            const user = checkResult.rows[0];
            const storedPassword = user.password;
            bcrypt.compare(password, storedPassword, (err, result) => {
                if(err){
                    return cb(err);
                }
                else{
                    if (result){
                        return cb(null, user);
                    }
                    else{
                        return cb(null, false);
                    }
                }
            });
        }
    }catch(err) {
        console.log(err);
    }
}))

passport.serializeUser((user, cb) => {
    cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
