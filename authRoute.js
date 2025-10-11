const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
const config = require("./config");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const verifyToken = require("./verifyToken");

const pool = mysql.createPool(config);

router.post("/register", async (req, res) => {
  console.log("✅ Register endpoint hit");
  const { username, email, password, church_id} = req.body;
    console.log("dyson",req.body);
  if (!username || !email || !password || !church_id ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const query = "INSERT INTO users (username,church_id, email, password) VALUES (?, ?, ?,?)";
    pool.query(query, [username,church_id, email, hashedPassword], (err, result) => {
      if (err) {
        console.error("❌ Database insert error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: "User registered successfully" });
    });
  } catch (err) {
    console.error("⚠️ Error in register route:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/login", (req, res) => {
  console.log("Login endpoint hit");
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "All fields are required" });

  const query = "SELECT * FROM users WHERE email = ?";
  pool.query(query, [email], async (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0)
      return res.status(401).json({ message: "Invalid email or password" });

    const user = results[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password" });

    // ✅ Generate JWT
    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: "5h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  });
});
router.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "This is protected", user: req.user });
});

router.get("/getallChurch", (req, res) => {    
    const query = "SELECT * FROM churchmaster"; 
    pool.query(query, (err, results) => {
      if (err) {
        console.error("❌ Database query error:", err);
        return res.status(500).json({ error: err.message });
      }
        res.json(results);          
    });
}       
);  


module.exports = router;
