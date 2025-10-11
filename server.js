const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const connectDB = require("./db");
const authRoute = require("./authRoute");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

connectDB();

app.use("/api/user", authRoute);

app.listen(port, () => {
  console.log(`🚀 Server running on port: ${port}`);
});
