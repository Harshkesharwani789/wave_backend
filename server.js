const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const connectDB = require("./config/database");
const path = require("path");
const multer = require("multer");
const morgan = require("morgan");
const fs = require("fs"); 
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
require("dotenv").config();
const bodyParser = require('body-parser');
const socketIo = require("socket.io"); // Add this
const http = require("http");
const app = express();
const server = http.createServer(app); // Create HTTP server
const io = socketIo(server, { // Initialize Socket.io
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  }
});


// Connect to MongoDB first
connectDB()
  .then(() => {
    console.log("Database connected successfully");
  })
  .catch((err) => {
    console.error("Database connection failed:", err);
    process.exit(1);
  });

// Middleware
app.use(morgan("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(
  cors({
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);





// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Wave API Documentation"
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure helmet with necessary adjustments
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// Create uploads directories if they don't exist
const dirs = [
  path.join(__dirname, "uploads"),
  path.join(__dirname, "uploads", "banners"),
  path.join(__dirname, "uploads", "promotional-banners"),
  path.join(__dirname, "uploads", "company-banners")
];

dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve static files with proper headers
const staticDirs = [
  { url: '/uploads', dir: 'uploads' },
  { url: '/uploads/banners', dir: 'uploads/banners' },
  { url: '/uploads/promotional-banners', dir: 'uploads/promotional-banners' },
  { url: '/uploads/company-banners', dir: 'uploads/company-banners' }
];

staticDirs.forEach(({ url, dir }) => {
  app.use(url, (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  }, express.static(path.join(__dirname, dir)));
});

// Import routes
const userRoutes = require("./routes/userRoutes");
const userServiceRoutes = require("./routes/userServiceRoutes");
const userBookingRoutes = require("./routes/userBookingRoutes");
const userAccountRoutes = require("./routes/userAccountRoutes");
const partnerRoutes = require("./routes/partnerRoutes");
const adminRoutes = require("./routes/adminRoutes");
// const partnersRoutes = require("./routes/partnerRoutes");
const adminServiceRoutes = require("./routes/adminServiceRoutes");
const bannerRoutes = require("./routes/bannerRoutes");
const serviceHierarchyRoutes = require("./routes/serviceHierarchyRoutes");
const adminBannerRoutes = require("./routes/adminBannerRoutes");
const userBannerRoutes = require("./routes/userBannerRoutes");
const adminBookingRoutes = require("./routes/adminBookingRoutes");
const adminBookingController = require('./controllers/adminBookingController');


// Routes
app.use("/api/user", userRoutes);
app.use("/api/user", userServiceRoutes);
app.use("/api/user", userBookingRoutes);
app.use("/api/user/account", userAccountRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/admin", adminRoutes);
// app.use("/api/admin/partners", partnersRoutes);
app.use("/api/admin/services", adminServiceRoutes);
app.use("/api/banners", bannerRoutes);
app.use("/api/public", serviceHierarchyRoutes);
app.use("/api/admin/banners", adminBannerRoutes);
app.use("/api/user/banners", userBannerRoutes);
app.use("/api/admin/bookings", adminBookingRoutes);


// Add this console.log
console.log('Registering admin routes...');

app.get('/admin/bookings', adminBookingController.getAllBookings);

// Keep only this 404 handler
app.use((req, res, next) => {
  console.log(`404 - Route not found: ${req.method} ${req.originalUrl}`);  // Added logging
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err : undefined,
  });
});






// Start server with better port handling
async function startServer(port) {
  const http = require("http");
  const server = http.createServer(app);

  function onError(error) {
    if (error.syscall !== "listen") throw error;

    const bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case "EACCES":
        console.error(bind + " requires elevated privileges");
        process.exit(1);
        break;
      case "EADDRINUSE":
        console.error(bind + " is already in use");
        process.exit(1);
        break;
      default:
        throw error;
    }
  }

  function onListening() {
    const addr = server.address();
    const bind =
      typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
    console.log("Server is running on " + bind);
  }

  server.on("error", onError);
  server.on("listening", onListening);

  try {
    await server.listen(port);
    console.log(`Server started successfully on port ${port}`);
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Use port from environment variable or default to 3000
const PORT = process.env.PORT || 9000;
startServer(PORT);


