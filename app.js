require("dotenv").config();
const express = require("express");
const app = express();
const cors = require("cors");
const connectDB = require("./db/connectDB");
const route_sites = require("./routes/route_sites");
const notFound = require("./routes/not_found");

// middleware
app.use(express.json());
app.use(
  cors({
    origin: "*",
    // methods: ["GET", "POST", "DELETE", "PATCH"],
  })
);

// routes
app.use("/api/sites", route_sites);
app.use(notFound);

const start = async () => {
  try {
    await connectDB(process.env.MONGO_DB_URI);
    app.listen(process.env.PORT || 5000, console.log("Server is on ..."));
  } catch (error) {
    console.log(error);
  }
};

start();
// const http = require("http");
// const mongoose = require("mongoose");

// mongoose
//   .connect(process.env.MONGO_DB_URI)
//   .then(() => console.log("connected to db"))
//   .catch((er) => console.log(er));

// const TaskSchema = new mongoose.Schema({
//   url: String,
// });

// const Task3 = mongoose.model("Websites", TaskSchema);

// var options = {
//   host: "google.com",
//   post: 443,
//   path: "/index.html",
// };

// http.get(options, (res) => {
//   var data = "";
//   res.on("data", (chunk) => {
//     data += chunk;
//   });

//   res.on("end", () => {
//     console.log(data);
//     const website = new Task3({ url: data });
//     website
//       .save()
//       .then(() => console.log("Done"))
//       .catch((er) => console.log(er));
//   });
// });
