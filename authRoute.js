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
      { user_id: user.user_ID, username: user.username, church_id: user.church_id },
      process.env.JWT_SECRET,
      { expiresIn: "5h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.user_ID, username: user.username, email: user.email, church_id: user.church_id },
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
// Get profile details form user table 
router.get("/getauser/:id", verifyToken, (req, res) => {    
    const { id } = req.params; 

    // Ensure the user can only access their own data
      if (req.user.user_id != id) {
        return res.status(403).json({ message: "Access denied" });
    }
    const query = "SELECT * FROM users WHERE user_ID = ?";
    pool.query(query, [id], (err, results) => {
      if (err) {
        console.error("❌ Database query error:", err);
        return res.status(500).json({ error: err.message });
      }       
        res.json(results[0]);          
    }
);  
}); 

// Load Type of products of particular church using church id and verifuy using user id from token
router.get("/getproductsbychurch/:church_id", verifyToken, (req, res) => {    
    const { church_id } = req.params; 
    // Ensure the user can only access their own church data
      if (req.user.church_id != church_id) {
        return res.status(403).json({ message: "Access denied" });
    } 
    const query = "SELECT * FROM seller_prices JOIN products ON seller_prices.product_id = products.product_id WHERE seller_prices.church_id = ?";
    pool.query(query, [church_id], (err, results) => {
      if (err) {
        console.error("❌ Database query error:", err);
        return res.status(500).json({ error: err.message });
      }
        res.json(results);
    }
);  
}
);





module.exports = router;
