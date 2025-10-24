const express = require("express");
const dotenv = require("dotenv");
dotenv.config();
const cors = require("cors");
const connectDB = require("./db");
const authRoute = require("./authRoute");

const app = express();
const port = process.env.PORT || 5000;

app.use(cors(
  {
   origin: [
     'http://localhost:4200',           // Local Angular dev
    'http://192.168.1.13:4200',        // Your local IP
    'https://YOUR_USERNAME.github.io'  // GitHub Pages (add this later)
  ],
  credentials:true
  }
));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

connectDB();

app.use("/api/user", authRoute);

app.listen(port, () => {
  console.log(`🚀 Server running on port: ${port}`);
});
