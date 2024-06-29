import bodyParser from "body-parser";
import express from "express";

const port = 80;
const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/", async (req, res) => {
    
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
