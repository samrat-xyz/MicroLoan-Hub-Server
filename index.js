const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

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

// JWT Middleware
const verifyJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader)
    return res.status(401).send({ message: "Unauthorized access" });

  const token = authHeader.split(" ")[1];

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).send({ message: "Forbidden access" });
    req.user = decoded;
    next();
  });
};

//  MongoDB Connect 
async function run() {
  try {
    await client.connect();
    console.log("MongoDB Connected Successfully!");
    const db = client.db("MicroLoan");
    const loansCollection = db.collection("loans");
    const appliedLoanCollection = db.collection("applied-loan");
    const usersCollection = db.collection("users");

    //ROOT 
    app.get("/", (req, res) => {
      res.send("MicroLoan Server Running...");
    });

    // LOGIN / JWT 
    app.post("/login", async (req, res) => {
      const { email } = req.body;
      if (!email) return res.status(400).send({ message: "Email required" });

      const user = await usersCollection.findOne({ email });
      if (!user) return res.status(404).send({ message: "User not found" });

      const token = jwt.sign({ email: user.email, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: "1d",
      });

      res.send({ token, user });
    });

    // USERS 
    app.get("/users", verifyJWT, async (req, res) => {
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

    app.patch("/users/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const { role, currentUserEmail } = req.body;

        if (req.user.role !== "manager") {
          return res.status(403).send({ message: "Only manager can change roles" });
        }

        if (currentUserEmail === req.user.email) {
          return res.status(403).send({ message: "You cannot update your own role!" });
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

    //LOANS 
    app.get("/loans", async (req, res) => {
      try {
        const result = await loansCollection.find().toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.post("/loans", verifyJWT, async (req, res) => {
      try {
        if (req.user.role !== "manager") {
          return res.status(403).send({ message: "Only manager can create loans" });
        }

        const { title, description, amount, interestRate, image } = req.body;
        if (!title || !description || !amount || !interestRate || !image) {
          return res.status(400).send({ message: "All fields are required" });
        }

        const newLoan = { title, description, amount, interestRate, image, createdAt: new Date() };
        const result = await loansCollection.insertOne(newLoan);

        res.send({ success: true, message: "Loan created successfully", loanId: result.insertedId });
      } catch (err) {
        res.status(500).send({ message: err.message });
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

    //APPLY LOAN
    app.post("/applied-loan", verifyJWT, async (req, res) => {
      try {
        const { userEmail, loanTitle } = req.body;
        const alreadyApplied = await appliedLoanCollection.findOne({ userEmail, loanTitle });
        if (alreadyApplied) {
          return res.status(409).send({ success: false, message: "You have already applied for this loan" });
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

    app.get("/applied-loans", verifyJWT, async (req, res) => {
      try {
        const email = req.query.email;
        let query = {};
        if (email) {
          if (req.user.role !== "manager") {
            query = { userEmail: email };
          }
        }

        const result = await appliedLoanCollection.find(query).toArray();
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.patch("/applied-loan/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const { status } = req.body;
        if (req.user.role !== "manager") {
          return res.status(403).send({ message: "Only manager can update loan status" });
        }
        const result = await appliedLoanCollection.updateOne({ _id: new ObjectId(id) }, { $set: { status } });
        res.send(result);
      } catch (err) {
        res.status(500).send({ message: err.message });
      }
    });

    app.delete("/applied-loan/:id", verifyJWT, async (req, res) => {
      try {
        const id = req.params.id;
        const result = await appliedLoanCollection.deleteOne({ _id: new ObjectId(id) });
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
