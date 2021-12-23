require("dotenv").config();
const http = require("http");
const mongoose = require("mongoose");

mongoose
  .connect(process.env.MONGO_DB_URI)
  .then(() => console.log("connected to db"))
  .catch((er) => console.log(er));

const TaskSchema = new mongoose.Schema({
  url: String,
});

const Task3 = mongoose.model("Websites", TaskSchema);

var options = {
  host: "example.com",
  post: 80,
  path: "/index.html",
};

http.get(options, (res) => {
  var data = "";
  res.on("data", (chunk) => {
    data += chunk;
  });

  res.on("end", () => {
    console.log(data);
    const website = new Task3({ url: data });
    website
      .save()
      .then(() => console.log("Done"))
      .catch((er) => console.log(er));
  });
});
