import bodyParser from "body-parser";
import express from "express";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import {Strategy} from "passport-local";
import env from "dotenv";
import axios from "axios";
import https from "https";
import fs from "fs";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken"

const port = 3000;
const app = express();
env.config();
const saltRounds = process.env.SALT_ROUNDS;

const db = new pg.Client({
  user: "postgres",
  host: process.env.DATABASE_HOST, // Enter EC2 end link Encrypt
  database: process.env.DATABASE_NAME,
  password: process.env.DATABASE_PASSWORD,
  port: 5432
});

let transporter = nodemailer.createTransport({
    service: 'Gmail', // You can use any other service, e.g., Yahoo, Outlook
    auth: {
      user: process.env.EMAIL, // Your email address
      pass: process.env.APP_PASSWORD   // Your email password
    }
  });

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
    const { category = 'Any', level = 'Any', sort = 'id', order = 'ASC' } = req.query;
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
    let ratings;
    if(name_and_author.length == 3){
        const order = name_and_author[2];
        const query = `SELECT * FROM ratings WHERE textbookid=${textbook.rows[0].id} ORDER BY stars ${order}`;
        ratings = await db.query(query);
    }
    else{
        ratings = await db.query('SELECT * FROM ratings WHERE textbookid=$1', [textbook.rows[0].id]);
    }
    if(req.isAuthenticated()){
        const username = req.user.username;
        const book_rating = await db.query('SELECT * FROM ratings WHERE username=$1 AND textbookid=$2', [username, textbook.rows[0].id]);
        let submitted = false;
        if(book_rating.rows.length > 0){
            submitted = true;
        }
        res.render("textbook.ejs", {textbook: textbook.rows[0], username: username, ratings: ratings.rows, submitted: submitted});
    } else {
        res.render("textbook.ejs", {textbook: textbook.rows[0], ratings: ratings.rows});
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
});

app.get("/contact", (req, res) => {
    if(req.isAuthenticated()){
        res.render("contact.ejs", {username: req.user.username});
    }else{
        res.render("contact.ejs");
    }
});

app.get("/edit/:textbookid", (req, res) => {
    if(!req.isAuthenticated()){
        console.log("hi");
        res.redirect("/");
    }
    else{
        res.render("edit.ejs", {textbookid: req.params.textbookid, username: req.user.username});
    }
});

app.get("/forgotpassword", (req, res) => {
    res.render("forgotpassword.ejs");
});

app.get('/reset-password', (req, res) => {
    const token = req.query.token;
    console.log(token);
    try {
        const decoded = jwt.verify(token, process.env.SESSION_SECRET);
        const userEmail = decoded.email;
        res.render("resetpassword.ejs", {userEmail: userEmail});
    } catch (error) {
        res.status(400).send('Invalid or expired token');
    }
});

// POST Requests!

app.post("/filter", (req, res) => {
    const category = req.body.category || 'Any';
    const level = req.body.level || 'Any';
    const sort = req.body.sort || 'rating';
    const order = req.body.order || 'ASC';
    res.redirect(`/?category=${encodeURIComponent(category)}&level=${encodeURIComponent(level)}&sort=${encodeURIComponent(sort)}&order=${encodeURIComponent(order)}`);
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
    let rating_description = req.body.rating_description;
    let category = req.body.category;
    let level = req.body.level;
    let summary = req.body.summary;
    let username = req.user.username;
    let id = await db.query("INSERT INTO textbooks (name, author, isbn, rating, numratings, category, level, summary) VALUES ($1, $2, $3, $4, 1, $5, $6, $7) RETURNING id;", [name, author, isbn, rating, category, level, summary]);
    await db.query("INSERT INTO ratings (username, textbookid, stars, rating) VALUES ($1, $2, $3, $4)", [username, id.rows[0].id, rating, rating_description]);
    res.redirect("/");
})

app.post("/rating", async (req, res) => {
    let username = req.user.username;
    const textbook = JSON.parse(req.body.textbook);
    let textbookid = textbook.id;
    let stars;
    try{
        stars = parseInt(req.body.stars);
    } catch (error){
        res.send("Please enter an integer (eg. 4) for the rating!");
    }
    let rating = req.body.rating;
    
    await db.query("INSERT INTO ratings (username, textbookid, stars, rating) VALUES ($1, $2, $3, $4);", [username, textbookid, stars, rating]);
    const url =  `/books/${textbook.name} by ${textbook.author}`;
    const new_rating = textbook.numratings+1;
    const new_stars = (textbook.rating*textbook.numratings+stars)/new_rating;
    await db.query("UPDATE textbooks SET numratings = $1, rating = $2 WHERE id = $3", [new_rating, new_stars, textbookid]);
    res.redirect(url);
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

app.post("/filterrating", (req, res) => {
    const textbook = JSON.parse(req.body.textbook);
    const order = req.body.order;
    const url =  `/books/${textbook.name} by ${textbook.author} by ${order}`;
    res.redirect(url);
});

app.post("/editreview", async (req, res) => {
    if(!req.isAuthenticated()){
        res.redirect("/");
    }
    else{
        const textbookid = parseInt(req.body.textbookid);
        let stars;
        try{
            stars = parseInt(req.body.stars);
        } catch(err){
            res.send("Please submit an integer for the rating!");
        }
        const message = req.body.message;
        const user = req.user.username;
        let prev_stars = await db.query("SELECT stars FROM ratings WHERE username=$1 AND textbookid=$2", [user, textbookid]);
        prev_stars = parseInt(prev_stars.rows[0].stars);
        await db.query("UPDATE ratings SET stars=$1, rating=$2 WHERE username=$3 AND textbookid=$4", [stars, message, user, textbookid]);
        const result = await db.query("SELECT * FROM textbooks WHERE id=$1", [textbookid]);
        const new_rating = (result.rows[0].rating*result.rows[0].numratings-prev_stars+stars)/result.rows[0].numratings;
        await db.query("UPDATE textbooks SET rating=$1 WHERE id=$2", [new_rating, textbookid]);
        const url = `/books/${result.rows[0].name} by ${result.rows[0].author}`;
        res.redirect(url);
    } 
});

app.post("/deleterating", async (req, res) => {
    const rating = JSON.parse(req.body.rating);
    const textbookid = parseInt(rating.textbookid);
    const stars = parseInt(rating.stars);
    let textbook = await db.query("SELECT * FROM textbooks WHERE id=$1", [textbookid]);
    const new_rating = (textbook.rows[0].rating*textbook.rows[0].numratings-stars)/(textbook.rows[0].numratings-1);
    await db.query("UPDATE textbooks SET rating=$1, numratings=$2 WHERE id=$3", [new_rating, textbook.rows[0].numratings-1, textbookid]);
    await db.query("DELETE FROM ratings WHERE id=$1", [rating.id]);
    const url = `/books/${textbook.rows[0].name} by ${textbook.rows[0].author}`;
    res.redirect(url);
});

app.post("/validateuser", (req, res) => {
    const email = req.body.email;
    const token = jwt.sign({ email: email }, process.env.SESSION_SECRET, { expiresIn: '1h' });
    const resetLink = `http://localhost:3000/reset-password?token=${token}`;
    let mailOptions = {
        from: `"TOTO" <${process.env.EMAIL}>`,
        to: email,
        subject: 'Password Reset',
        text: `Click on the following link to reset your password: ${resetLink}`,
        html: `<p>Click on the following link to reset your password:</p><a href="${resetLink}">${resetLink}</a>. <p>If you did not choose to 
        reset your password, please ignore this email.<p>`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          return console.log('Error:', error);
        }
        console.log('Message sent: %s', info.messageId);
        console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    });

    res.send("Please check your email for a reset link!");
});

app.post("/reset-password", async (req, res) => {
    const userEmail = req.body.email;
    const newPassword = req.body.password;
    bcrypt.hash(newPassword, saltRounds, async (err, hash) => {
        if(err){
            console.log(err);
        }
        else{
            console.log(userEmail);
            const result = await db.query("UPDATE users SET password=$1 WHERE email=$2 RETURNING *;", [hash, userEmail]);
            const user = result.rows[0];
            req.login(user, (err) => {
                console.log(err);
                res.redirect("/");
            })
        }
    });
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
    console.log('HTTP server running on port 3000');
});