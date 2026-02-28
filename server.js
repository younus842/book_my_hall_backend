require("dotenv").config();
const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Fake DB (Replace with Mongo/Postgres later)
let bookings = [];

/*
====================================
STEP 1 - CREATE ORDER
====================================
*/
app.post("/create-order", async (req, res) => {
  try {
    const { amount, date, hallId } = req.body;

    const options = {
      amount: amount * 100, // in paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    };

    const order = await razorpay.orders.create(options);

    // Save temporary booking (pending)
    bookings.push({
      hallId,
      date,
      orderId: order.id,
      status: "PENDING",
    });

    res.json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Order creation failed" });
  }
});

/*
====================================
STEP 5 - VERIFY SIGNATURE
====================================
*/
app.post("/verify-payment", (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature === razorpay_signature) {

      // Update booking status
      const booking = bookings.find(
        (b) => b.orderId === razorpay_order_id
      );

      if (booking) {
        booking.status = "CONFIRMED";
        booking.paymentId = razorpay_payment_id;
      }

      res.json({ success: true, message: "Payment verified" });

    } else {
      res.status(400).json({ success: false });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Verification failed" });
  }
});

app.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);
