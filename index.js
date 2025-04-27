const express = require("express");
const session = require("express-session");
const passport = require("./middlewares/googleAuth"); // Ensure correct path
const cors = require("cors");
require("dotenv").config();
require("./model/db");

const app = express();
const port = process.env.PORT || 8080;

// Import routers
const AuthRouter = require("./routes/AuthRouter");
const dashrouter = require("./routes/dashrouter");
const datasetRouter = require("./routes/datasetRouter");

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: "https://smart-saver-frontend.vercel.app",
    credentials: true,
  })
);

app.use(
  session({
    secret: "secret-key",
    resave: false,
    saveUninitialized: true,
  })
);

app.use(passport.initialize());
app.use(passport.session());

// Routes
app.use("/auth", AuthRouter);
app.use("/dashboard", dashrouter);
app.use("/admin", dashrouter);
app.use("/dataset", datasetRouter);

// Start server
app.listen(port, () => console.log(`App listening on port ${port}!`));
