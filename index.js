const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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
    const MicroLoanCollection = MicroLoan.collection("loans");
    const appliedLoanCollection = MicroLoan.collection("applied-loan");
    // Send a ping to confirm a successful connection
    app.get("/loans", async (req, res) => {
      const cursor = MicroLoanCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/loans/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await MicroLoanCollection.findOne(query);
      res.send(result);
    });

    app.get("/top-loans", async (req, res) => {
      const cursor = MicroLoanCollection.find().limit(6).skip(4);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.post("/applied-loan", async (req, res) => {
      const { userEmail, loanTitle } = req.body;

    
      const alreadyApplied = await appliedLoanCollection.findOne({
        userEmail,
        loanTitle,
      });

      if (alreadyApplied) {
        return res.status(409).send({
          success: false,
          message: "You have already applied for this loan",
        });
      }

      
      const result = await appliedLoanCollection.insertOne({
        ...req.body,
        status: "Pending",
        applicationFeeStatus: "Unpaid",
        appliedAt: new Date(),
      });

      res.send({
        success: true,
        insertedId: result.insertedId,
      });
    });

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
