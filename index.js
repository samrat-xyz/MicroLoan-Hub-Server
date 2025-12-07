const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ServerApiVersion } = require("mongodb");
const uri = process.env.DB_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
const app = express();
app.use(cors());
app.use(express.json());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});
async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    // await client.connect();
    const MicroLoan = client.db("MicroLoan");
    const MicroLoanCollection = MicroLoan.collection("loans")
    // Send a ping to confirm a successful connection
    app.get("/loans",async(req,res)=>{
        const cursor = MicroLoanCollection.find();
        const result = await cursor.toArray()
        res.send(result)
    })
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //  await client.close();
  }
}
run().catch(console.dir);
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
