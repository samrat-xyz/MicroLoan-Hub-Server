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
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully!");

    const db = client.db("MicroLoan");
    const loansCollection = db.collection("loans");
    const appliedLoanCollection = db.collection("applied-loan");
    const usersCollection = db.collection("users");

    //LOANS
    app.get("/loans", async (req, res) => {
      try {
        const result = await loansCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });
    //CREATE LOAN 
    app.post("/loans", async (req, res) => {
      try {
        const { title, description, amount, interestRate, image } = req.body;

        // Simple validation
        if (!title || !description || !amount || !interestRate || !image) {
          return res.status(400).send({ message: "All fields are required" });
        }

        const newLoan = {
          title,
          description,
          amount,
          interestRate,
          image,
          createdAt: new Date(),
        };

        const result = await loansCollection.insertOne(newLoan);

        res.send({
          success: true,
          message: "Loan created successfully",
          loanId: result.insertedId,
        });
      } catch (err) {
        console.error(err);
        res
          .status(500)
          .send({ message: "Failed to create loan", error: err.message });
      }
    });

    app.get("/loans/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await loansCollection.findOne({ _id: new ObjectId(id) });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.get("/top-loans", async (req, res) => {
      try {
        const result = await loansCollection.find().limit(6).skip(4).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    //USERS
    app.get("/users", async (req, res) => {
      try {
        const result = await usersCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;

        const exists = await usersCollection.findOne({ email: user.email });
        if (exists) {
          return res.status(409).send({ message: "User already exists" });
        }

        const result = await usersCollection.insertOne(user);
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.delete("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await usersCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.patch("/users/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { role, currentUserEmail } = req.body;

        const userToUpdate = await usersCollection.findOne({
          _id: new ObjectId(id),
        });

       
        if (userToUpdate.email === currentUserEmail) {
          return res
            .status(403)
            .send({ message: "You cannot update your own role!" });
        }

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { role } }
        );

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.get("/users/role/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await usersCollection.findOne({ email });
        res.send({ role: user?.role || "borrower" });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    //  APPLY LOAN
    app.post("/applied-loan", async (req, res) => {
      try {
        const { userEmail, loanTitle } = req.body;

        const alreadyApplied = await appliedLoanCollection.findOne({
          userEmail,
          loanTitle,
        });
        if (alreadyApplied) {
          return res
            .status(409)
            .send({
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

        res.send({ success: true, insertedId: result.insertedId });
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.get("/applied-loans", async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};

        if (email) {
          const user = await usersCollection.findOne({ email });
          if (user?.role !== "manager") {
            query = { userEmail: email };
          }
        }

        const result = await appliedLoanCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.patch("/applied-loan/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;

        const result = await appliedLoanCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status } }
        );

        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.delete("/applied-loan/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const result = await appliedLoanCollection.deleteOne({
          _id: new ObjectId(id),
        });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });
  } catch (err) {
    console.error("MongoDB connection failed:", err.message);
  }
}

run();

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});