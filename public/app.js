// app.js
const express = require('express');
const mysql = require('mysql');
const app = express();
const {Client} = require("@elastic/elasticsearch");

const esClient = new Client({
  cloud: {
    id: "4854822fc0674d59a3533089c656d94b:dXMtY2VudHJhbDEuZ2NwLmNsb3VkLmVzLmlvOjQ0MyRlN2JiYTE2ODBiNTk0ZmVkOTViYWM3MmY5ZDU0MjA0NSQ2ZmNjMjgyZTk5YWU0M2Q5OGIxZjk4YmVjOThlYjY3NA=="
  },
  auth: {
    username: 'elastic',
    password: 'EfbPdu0k6rpvevG2umcksu9j'
  }
});

// Create connection to MySQL database

const connection = mysql.createConnection({
  host: "sql6.freesqldatabase.com",
  user: "sql6685546",
  password: "eugifeb7jt",
  database: "sql6685546",
});

// Connect to the database
connection.connect(err => {
    if (err) {
        console.error('Error connecting to database: ' + err.stack);
        return;
    }
    console.log('Connected to database.');
});

// Route to fetch and respond with all categories in JSON format
app.get('/api/categories', (req, res) => {
    const page = parseInt(req.query.page) || 1; // Get page number from query parameter, default to 1 if not provided

    const pageSize = 5; // Number of categories per page

    // Calculate offset based on page number
    const offset = (page - 1) * pageSize;

    // Query to fetch categories from the database with pagination
    const query = `SELECT * FROM categories LIMIT ${pageSize} OFFSET ${offset}`;

    // Execute the query
    connection.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching categories: ' + err.stack);
            res.status(500).send('Error fetching categories from database.');
            return;
        }

        // Query to count total number of categories
        const countQuery = `SELECT COUNT(*) AS totalCategories FROM categories`;

        // Execute the count query
        connection.query(countQuery, (countErr, countResult) => {
            if (countErr) {
                console.error('Error counting categories: ' + countErr.stack);
                res.status(500).send('Error counting categories in database.');
                return;
            }

            // Calculate total pages based on total categories and page size
            const totalCategories = countResult[0].totalCategories;
            const totalPages = Math.ceil(totalCategories / pageSize);

            // Render the 'categories.ejs' template with the fetched categories and total pages
            res.json({ categories: results, currentPage: page, totalPages: totalPages });
        });
    });
});

app.get('/categories',(req,res)=>{
  res.sendFile(__dirname+'/categories.html');
});


// Route to fetch and display all products in HTML
app.get('/api/all-products', (req, res) => {
  const page = parseInt(req.query.page) || 1; // Get page number from query parameter, default to 1 if not provided
  const pageSize = 10; // Number of products per page

  // Calculate offset based on page number
  const offset = (page - 1) * pageSize;

  // Query to count total number of products
  const countQuery = `SELECT COUNT(*) AS totalProducts FROM products`;

  // Execute the count query
  connection.query(countQuery, (countErr, countResult) => {
      if (countErr) {
          console.error('Error counting products: ' + countErr.stack);
          res.status(500).send('Error counting products in database.');
          return;
      }

      // Calculate total number of products
      const totalProducts = countResult[0].totalProducts;

      // Query to fetch all products from the database with pagination
      const query = `SELECT * FROM products LIMIT ${pageSize} OFFSET ${offset}`;

      // Execute the query to fetch products
      connection.query(query, (err, products) => {
          if (err) {
              console.error('Error fetching products: ' + err.stack);
              res.status(500).send('Error fetching products from database.');
              return;
          }

          // Query to fetch all categories
          const categoriesQuery = `SELECT * FROM categories`;

          // Execute the query to fetch categories
          connection.query(categoriesQuery, (categoriesErr, categories) => {
              if (categoriesErr) {
                  console.error('Error fetching categories: ' + categoriesErr.stack);
                  res.status(500).send('Error fetching categories from database.');
                  return;
              }

              // Calculate total pages based on total products and page size
              const totalPages = Math.ceil(totalProducts / pageSize);

              // Render the 'products.ejs' template with the fetched products, categories, and total pages
              res.json( { products: products, categories: categories, currentPage: page, totalPages: totalPages, categoryId: categories.catId });

            });
      });
  });
});

app.get('/all-products',(req,res)=>{
  res.sendFile(__dirname+'/products-all.html');
});


app.get("/api/products/search", async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    var query = req.query.productSearch;
    var down = ["under", "below", "less", "within", "down", "lesser", "in"];
    var eq = ["=", "@"];
    var up = ["over", "above", "greater", "up"];
    var extra = [",",".","/",":","[","]","rs","Rs", "amt", "Amt", "+", "-", "than",];

  
    var string = query.split(" ");
    var cur, sort;
  
    extra.forEach((val) => {
      if (query.includes(val)) {
        query = query.replace(val, "");
      }
    });
  
    string.forEach((val) => {
      if (down.includes(val)) {
        cur = val;
        sort = "lte";
        return;
      } else if (up.includes(val)) {
        cur = val;
        sort = "gte";
        return;
      }
    });
  
    if (cur) {
      var [data, price] = query.split(cur);
      var value = parseFloat(price);
    } else {
      var data = query;
      var value = 10000000;
      sort = "lte";
    }
  
    try {
      let response = await esClient.search({
        index: "index-products",
        body: {
          query: {
            bool: {
              must: [
                {
                  exists: {
                    field: "discounted_price",
                  },
                },
                {
                  range: {
                    discounted_price: {[sort]: value,
                    },
                  },
                },
              ],
              should: [
                {
                  multi_match: { 
                    query: data, 
                    fields: ["prod_brand","prod_name", "cat_name"], 
                    fuzziness:"AUTO"
                    },
                },
              ],
              minimum_should_match: 1,
            },
          },
          _source: ["prod_id","prod_name","prod_brand","price","discounted_price", "created_date","cat_id"],
        },
      });
      if (response && response.hits) { // Check if hits exist and total hits count is greater than 0
        let data = response.hits.hits;
        let results = data.map((hit) => hit._source);
        let pageSize = 5;
        let totalPages = Math.ceil(results.length/pageSize);
        
        const currentPage = parseInt(req.query.page) || 1;
        res.json({
          results: results,
          categoryId: req.params.categoryId,
          currentPage: currentPage,
          totalPages: totalPages,
          productSearch: req.query.productSearch // Pass the categorySearch parameter to the template
        });
      }
    } catch (error) {
      console.error("Error executing Elasticsearch query:", error);
      res.status(500).send("Internal Server Error");
    }
});

app.get('/products/search',(req,res)=>{
    res.sendFile(__dirname+'/products-search.html');
});


app.get('/api/product/:cat_id', (req, res) => {
  const catId = req.params.cat_id;
  const page = parseInt(req.query.page) || 1; // Get page number from query parameter, default to 1 if not provided
  const pageSize = 10; // Number of products per page

  // Calculate offset based on page number
  const offset = (page - 1) * pageSize;

  // Query to count total number of products for the specific category
  const countQuery = `SELECT COUNT(*) AS totalProducts FROM products WHERE cat_id = ${catId}`;

  // Execute the count query
  connection.query(countQuery, (countErr, countResult) => {
      if (countErr) {
          console.error('Error counting products: ' + countErr.stack);
          res.status(500).send('Error counting products in database.');
          return;
      }

      // Calculate total number of products for the category
      const totalProducts = countResult[0].totalProducts;

      // Query to fetch products of the specified category from the database with pagination
      const query = `SELECT * FROM products WHERE cat_id = ${catId} LIMIT ${pageSize} OFFSET ${offset}`;

      // Execute the query to fetch products
      connection.query(query, (err, products) => {
          if (err) {
              console.error('Error fetching products: ' + err.stack);
              res.status(500).send('Error fetching products from database.');
              return;
          }

          // Query to fetch all categories
          const categoriesQuery = `SELECT * FROM categories`;

          // Execute the query to fetch categories
          connection.query(categoriesQuery, (categoriesErr, categories) => {
              if (categoriesErr) {
                  console.error('Error fetching categories: ' + categoriesErr.stack);
                  res.status(500).send('Error fetching categories from database.');
                  return;
              }

              // Calculate total pages based on total products and page size
              const totalPages = Math.ceil(totalProducts / pageSize);

              // Render the 'products.ejs' template with the fetched products, categories, and total pages
              res.json( { products: products, categories: categories, currentPage: page, categoryId: catId, totalPages: totalPages });
          });
      });
  });
});

app.get('/product/:cat_id',(req,res)=>{
  res.sendFile(__dirname+'/products-category.html');
});

const PORT = 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
