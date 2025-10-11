const mysql = require("mysql2");
const config = require("./config");

const connectDB = () => {
  const pool = mysql.createPool(config);

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error connecting to MySQL:", err.message);
      return; // exit early if connection fails
    }

    console.log("Connected to MySQL database");

    // Release connection safely
    if (connection) connection.release();
  });

  return pool; // return pool so it can be used elsewhere
};

module.exports = connectDB;
