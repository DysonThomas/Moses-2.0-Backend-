const express = require("express");
const router = express.Router();
const mysql = require("mysql2");
const config = require("./config");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const verifyToken = require("./verifyToken");
const Razorpay = require('razorpay');

const pool = mysql.createPool(config);

router.post("/register", async (req, res) => {
  console.log("✅ Register endpoint hit");
  const { username, email, password, } = req.body;
    console.log("dyson",req.body);
  if (!username || !email || !password  ) {
    return res.status(400).json({ message: "All fields are required" });
  }

  try {

    const hashedPassword = await bcrypt.hash(password, 10);

    const query = "INSERT INTO users (username, email, password,role) VALUES (?, ?,?,3)";
    pool.query(query, [username, email, hashedPassword], (err, result) => {
      if (err) {
        console.error("❌ Database insert error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: "User registered successfully", user_id: result.insertId  });
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
      { user_id: user.user_ID, username: user.username},
      process.env.JWT_SECRET,
      { expiresIn: "5h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user.user_ID, username: user.username, email: user.email, role: user.role }, 
        });
  });
});
router.get("/protected", verifyToken, (req, res) => {
  res.json({ message: "This is protected",cstatus : 'verified', user: req.user });
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
    const query = "SELECT * FROM user_profile WHERE user_ID = ?";
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
    
    const query = "SELECT * FROM seller_prices JOIN products ON seller_prices.product_id = products.product_id WHERE seller_prices.church_id = ?";
    pool.query(query, [church_id], (err, results) => {
      if (err) {
        console.error("❌ Database query error:", err);
        return res.status(500).json({ error: err.message });
      }
        res.json(results);
    }
);  
});

// api to add  user profile details
router.post("/adduserprofile", (req, res) => {
  const { user_id,username, dob, housename,place,district,state,country,gender, phone_number,church_id } = req.body;
  // Get user ID from verified token
  console.log("User Profile Data:", user_id);

  const query = `
    INSERT INTO user_profile
    (user_ID,username, dob, housename,place,district,state,country,gender, phone_number,church_id)
    VALUES (?, ?, ?, ?, ?, ?, ?,?,?,?,?)
  `;

  pool.query(
    query,
    [user_id,username, dob, housename,place,district,state,country,gender, phone_number,church_id],
    (err, result) => {
      if (err) {
        console.error("❌ Database insert error:", err);
        return res.status(500).json({ error: err.message });
      }

      res.status(201).json({ message: "User profile added successfully" });
    }
  );
});
router.put("/updateuserprofile/:user_id", verifyToken, (req, res) => {
  const { user_id } = req.params;

  const { username, dob, housename, place, district, state, country, gender, phone_number } = req.body;
  console.log("Update Profile Data:", user_id, req.body);
  
  // Ensure the user can only update their own profile
  if (req.user.user_id != user_id) {
    return res.status(403).json({ message: "Access denied" });
  }

  // Convert empty strings to NULL for date fields
  const formattedDob = dob && dob.trim() !== '' ? dob : null;
  const formattedPhone = phone_number && phone_number.trim() !== '' ? phone_number : null;

  const query = `
    UPDATE user_profile
    SET username = ?, dob = ?, housename = ?, place = ?, district = ?, state = ?, country = ?, gender = ?, phone_number = ?
    WHERE user_ID = ?
  `;  // ✅ Use user_ID to match database column
  
  pool.query(
    query,
    [username, formattedDob, housename, place, district, state, country, gender, formattedPhone, user_id],
    (err, result) => {
      if (err) {      
        console.error("❌ Database update error:", err);
        return res.status(500).json({ error: err.message });
      }     
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "User profile not found" });
      }

      res.json({ message: "User profile updated successfully" });
    } 
  );
});

router.get("/getuserprofile/:user_id", verifyToken, (req, res) => {
  const { user_id } = req.params; 
  if (req.user.user_id != user_id) {
    return res.status(403).json({ message: "Access denied" });
  }
  const query = "SELECT * FROM user_profile WHERE user_ID = ?"; // ✅ Use user_ID to match database column  
  pool.query(query, [user_id], (err, results) => {
    if (err) {
      console.error("❌ Database query error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: "User profile not found" });
    }
    res.json(results[0]);
  });
});
router.get("/getrole/:user_id", verifyToken, (req, res) => {
  const { user_id } = req.params; 
  if (req.user.user_id != user_id) {
    return res.status(403).json({ message: "Access denied" });
  }
  const query = "SELECT * FROM users WHERE user_ID = ?"; // ✅ Use user_ID to match database column  
  pool.query(query, [user_id], (err, results) => {
    if (err) {
      console.error("❌ Database query error:", err);
      return res.status(500).json({ error: err.message });
    }
    
    if (results.length === 0) {
      return res.status(404).json({ message: "User profile not found" });
    }
    res.json(results[0]);
  });
});
router.get("/getchurchidbyuserid/:user_id", verifyToken, (req, res) => {  
  const { user_id } = req.params;

  if (req.user.user_id != user_id) {
    return res.status(403).json({ message: "Access denied" });
  }
  const query = "SELECT church_id FROM user_profile WHERE user_ID = ?";  
  pool.query(query, [user_id], (err, results) => {
    if (err) {

      console.error("❌ Database query error:", err);
      return res.status(500).json({ error: err.message });
    }   
    if (results.length === 0) {
      return res.status(404).json({ message: "Church ID not found for user" });
    } 
    res.json({ church_id: results[0].church_id });
  }
);  
}

);
// api to update the cost of productsusing product id 
router.put("/updateproductprice/:product_id", verifyToken, (req, res) => {
  const { product_id } = req.params;
  const { price } = req.body;
  const query = `
    UPDATE seller_prices
    SET price = ?
    WHERE id = ?
  `;
  pool.query(query, [price,product_id], (err, result) => {
    if (err) {
      console.error("❌ Database update error:", err);
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Product cost updated successfully" });
  });
});

// Delete a product using product id 
router.delete("/deleteproduct/:product_id", verifyToken, (req, res) => {
  const { product_id } = req.params;
  const query = `
    DELETE FROM seller_prices
    WHERE id = ?
  `;
  pool.query(query, [product_id], (err, result) => {
    if (err) {
      console.error("❌ Database delete error:", err);
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json({ message: "Product deleted successfully" });
  });
});

router.get("/getallproducts", (req, res) => {    
    const query = "SELECT * FROM products";
    pool.query(query, (err, results) => {
      if (err) {
        console.error("❌ Database query error:", err);
        return res.status(500).json({ error: err.message });
      }
        res.json(results);          
    } 
);  
}   

);
router.get("/getproducts", (req, res) => {    
    const query = "SELECT *,c.isRegular FROM products p join seller_prices c ON c.product_id=p.product_id";
    pool.query(query, (err, results) => {
      if (err) {
        console.error("❌ Database query error:", err);
        return res.status(500).json({ error: err.message });
      }
        res.json(results);          
    } 
);  
}   
);


// add a product to seller_prices table 
router.post("/addproduct", verifyToken, (req, res) => {
  const { church_id, product_id, price, isRegular } = req.body;
  const query = `
    INSERT INTO seller_prices (church_id, product_id, price, isRegular)
    VALUES (?, ?, ?, ?)
  `;
  pool.query(
    query,
    [church_id, product_id, price, isRegular],
    (err, result) => {
      if (err) {
        console.error("❌ Database insert error:", err);
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({ message: "Product price added successfully", id: result.insertId });
    }
  );
} 
);  

// api to add razorpay key details
router.post("/addrazorpaykeys", verifyToken, (req, res) => {
  const { church_id, key_id, key_secret } = req.body;
  const query = `
    INSERT INTO paymentconfig (church_id, api_key, password)
    VALUES (?, ?, ?)
  `;
  pool.query(query, [church_id, key_id, key_secret], (err, result) => {
    if (err) {
      console.error("❌ Database insert error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.status(201).json({ message: "Razorpay key added successfully", id: result.insertId });
  });
});

// api to get razorpay key details by church id
router.get("/getrazorpaykeys/:church_id", verifyToken, (req, res) => {
  const { church_id } = req.params;
  const query = `
    SELECT api_key, password
    FROM paymentconfig
    WHERE church_id = ?
  `;
  pool.query(query, [church_id], (err, results) => {
    if (err) {
      console.error("❌ Database query error:", err);
      return res.status(500).json({ error: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ message: "Razorpay keys not found for church" });
    }
    res.json(results[0]);
  });
});

// api to delete razorpay key details by church id
router.delete("/deleterazorpaykey/:church_id", verifyToken, (req, res) => {
  const { church_id } = req.params;
  const query = `
    DELETE FROM paymentconfig
    WHERE church_id = ?
  `;
  pool.query(query, [church_id], (err, result) => {
    if (err) {  
      console.error("❌ Database delete error:", err);
      return res.status(500).json({ error: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Razorpay keys not found for church" });
    }
    res.json({ message: "Razorpay keys deleted successfully" });
  }
);
});
// create order forrazorpay
router.post("/createorder", verifyToken, async (req, res) => {
  const { amount, currency, church_id } = req.body;

  try {
    const keys =await getPaymentkeys(church_id);
  
    const razorpay = new Razorpay({
      key_id: keys.api_key,
      key_secret: keys.password,
    });
    const data = await razorpay.orders.create({
      amount: amount * 100, // Razorpay expects amount in smallest currency unit (paise for INR)
      currency: currency,
      receipt: 'RCP_ID_' + Date.now() + Math.floor(Math.random() * 10000)
    });

    res.json({
      amount: data.amount,
      id: data.id,
      key: keys.api_key,
      currency: data.currency,
      status: data.status,
    });
  } catch (error) {
    console.error("❌ Razorpay order creation error:", error);
    res.status(500).json({ message: "Server error" });
  }
});
getPaymentkeys = (church_id) => {
  return new Promise((resolve, reject) => {
    const query = `
      SELECT api_key, password
      FROM paymentconfig
      WHERE church_id = ?
    `;

    pool.query(query, [church_id], (err, results) => {
      if (err) {
        return reject(err);
      }
      if (results.length === 0) {
        return reject(new Error("No payment keys found"));
      }
      resolve(results[0]);
    });
  });
};

router.post("/addorder", verifyToken, (req, res) => {
  const { user_id, amount, currency, status, church_id ,order_id,payment_id,signature,products } = req.body;
  const productsData = typeof products === "object" ? JSON.stringify(products) : products;
  console
  if (!user_id || !amount || !currency || !status || !church_id || !order_id || !payment_id) {
  return res.status(400).json({ message: "Missing required fields" });
}

  const query = `
    INSERT INTO orders (user_id,church_id,amount,currency, status,order_id,payment_id,signature,products)
    VALUES (?, ?, ?, ?,?, ?, ?, ?,?)
  `;

  pool.query(query, [user_id,church_id,amount,currency, status,order_id,payment_id,signature,productsData], (err, result) => {
    if (err) {
      console.error("❌ Database insert error:", err);
      return res.status(500).json({ error: err.message });
    }

    res.status(201).json({ message: "Order added successfully", order_id: result.insertId });
  });
});

// api to fetch user orders based on user id
router.get("/getuserorders/:user_id", verifyToken, (req, res) => {
  console.log("Get User Orders endpoint hit");

  const { user_id } = req.params;

  if (req.user.user_id != user_id) {
    return res.status(403).json({ message: "Access denied" });
  }

  const query = "SELECT * FROM orders WHERE user_id = ? Order BY created_at DESC";  
  pool.query(query, [user_id], (err, results) => {
    if (err) {
      console.error("❌ Database query error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

// api to get all orders using church id and date between
router.post("/getchurchorders", verifyToken, (req, res) => {
  console.log("Get Church Orders endpoint hit");
  const { church_id,fromDate,toDate} = req.body;
  console.log("Get Church Orders endpoint hit");  
 const today = new Date().toISOString().slice(0, 10);
const start = `${fromDate || today} 00:00:00`;
const end = `${toDate || today} 23:59:59`;
 console.log("Chruch ID:", church_id, "From:", start, "To:", end);
  const query = `SELECT id,
  	JSON_UNQUOTE(JSON_EXTRACT(p.json, '$.type')) AS type,
    JSON_UNQUOTE(JSON_EXTRACT(p.json, '$.product_name')) AS product_name,
    JSON_UNQUOTE(JSON_EXTRACT(p.json, '$.name')) AS customer_name
FROM orders o,
JSON_TABLE(o.products, '$[*]' 
    COLUMNS (
        json JSON PATH '$',
        type VARCHAR(50) PATH '$.type',
        price VARCHAR(50) PATH '$.price'
    )
) AS p WHERE
o.church_id = ?
      AND o.created_at BETWEEN ? AND ?
    ORDER BY type desc`;
  pool.query(query, [church_id, start, end], (err, results) => {
    if (err) {
      console.error("❌ Database query error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});

router.post("/getspecificorders", verifyToken, (req, res) => {
 
  const { church_id, fromDate, toDate, pType } = req.body;
  console.log("Get Specific Orders endpoint hit");
 

  const today = new Date().toISOString().slice(0, 10);
  const start = `${fromDate || today} 00:00:00`;
  const end = `${toDate || today} 23:59:59`;

   console.log("Church ID:", church_id, "From:", start, "To:", end, "Product Type:", pType);

  let query = `
    SELECT 
      id,
      JSON_UNQUOTE(JSON_EXTRACT(p.json, '$.type')) AS type,
      JSON_UNQUOTE(JSON_EXTRACT(p.json, '$.product_name')) AS product_name,
      JSON_UNQUOTE(JSON_EXTRACT(p.json, '$.name')) AS customer_name
    FROM orders o,
    JSON_TABLE(o.products, '$[*]' 
      COLUMNS (
        json JSON PATH '$',
        type VARCHAR(50) PATH '$.type',
        price VARCHAR(50) PATH '$.price'
      )
    ) AS p
    WHERE o.church_id = ?
      AND o.created_at BETWEEN ? AND ?
  `;

  const params = [church_id, start, end];

  if (Array.isArray(pType) && pType.length > 0) {
    // Multiple types
    const placeholders = pType.map(() => '?').join(',');
    query += ` AND type IN (${placeholders})`;
    params.push(...pType);
  } else if (pType) {
    // Single type
    query += ` AND type = ?`;
    params.push(pType);
  }

  query += ` ORDER BY type DESC`;

  pool.query(query, params, (err, results) => {
    if (err) {
      console.error("❌ Database query error:", err);
      return res.status(500).json({ error: err.message });
    }
    res.json(results);
  });
});




module.exports = router;
