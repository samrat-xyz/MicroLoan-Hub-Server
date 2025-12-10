const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const admin = require("firebase-admin");

const serviceAccount = require("./firebaseAdminSdk.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uri = process.env.DB_URI;

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
  res.send("MicroLoan Server Running...");
});

async function run() {
  const MicroLoan = client.db("MicroLoan");

  const loansCollection = MicroLoan.collection("loans");
  const appliedLoanCollection = MicroLoan.collection("applied-loan");
  const usersCollection = MicroLoan.collection("users");

  app.get("/loans", async (req, res) => {
    const result = await loansCollection.find().toArray();
    res.send(result);
  });

  app.get("/loans/:id", async (req, res) => {
    const id = req.params.id;

    const result = await loansCollection.findOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  });

  app.get("/top-loans", async (req, res) => {
    const result = await loansCollection.find().limit(6).skip(4).toArray();
    res.send(result);
  });

  app.post("/users", async (req, res) => {
    const user = req.body;

    const exists = await usersCollection.findOne({ email: user.email });

    if (exists) {
      return res.send({ message: "user already exists" });
    }

    const result = await usersCollection.insertOne(user);
    res.send(result);
  });

  app.get("/users/role/:email", async (req, res) => {
    const email = req.params.email;

    const user = await usersCollection.findOne({ email });

    res.send({ role: user?.role || "borrower" });
  });

  app.post("/applied-loan", async (req, res) => {
    const { userEmail, loanTitle } = req.body;

    //  DUPLICATE CHECK
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

  app.get("/applied-loans", async (req, res) => {
    const email = req.query.email;

    const user = await usersCollection.findOne({ email });

    if (user?.role !== "manager") {
      return res.status(403).send({ message: "Forbidden Access" });
    }

    const result = await appliedLoanCollection.find().toArray();
    res.send(result);
  });

  app.patch("/applied-loan/:id", async (req, res) => {
    const id = req.params.id;
    const status = req.body.status;

    const result = await appliedLoanCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    res.send(result);
  });

  app.delete("/applied-loan/:id", async (req, res) => {
    const id = req.params.id;

    const result = await appliedLoanCollection.deleteOne({
      _id: new ObjectId(id),
    });

    res.send(result);
  });

  await client.db("admin").command({ ping: 1 });
  console.log(" MongoDB Connected Successfully!");
}

run();

app.listen(port, () => {
  console.log(` Server running on http://localhost:${port}`);
});
