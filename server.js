const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const pool = require('./routes/db');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

async function initializeDatabase() {
    try {
        const sqlPath = path.join(__dirname, './routes/init.sql');
        const sql = fs.readFileSync(sqlPath).toString();
        await pool.query(sql);
        console.log("✅ Database initialized: Tables created or already exist.");
    } catch (err) {
        console.error("❌ Error initializing database:", err);
    }
}

initializeDatabase();

// --- HALL ROUTES ---

app.get('/api/halls', async (req, res) => {
    try {
        const allHalls = await pool.query("SELECT * FROM halls ORDER BY id DESC");
        res.json(allHalls.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

app.post('/api/admin/halls', async (req, res) => {
    try {
        const { 
            name, address, city, price, description, 
            location_lat, location_lng, images, package_details 
        } = req.body;

        const owner_id = 1; 
        const validImages = Array.isArray(images) ? images : [];
        const cleanLat = location_lat ? parseFloat(location_lat) : 0;
        const cleanLng = location_lng ? parseFloat(location_lng) : 0;
        const cleanPrice = price ? parseFloat(price) : 0;
        const cleanPackage = package_details ? JSON.stringify(package_details) : JSON.stringify({});

        const newHall = await pool.query(
            `INSERT INTO halls (
                name, address, city, price, description, 
                location_lat, location_lng, images, package_details, owner_id, booked_dates
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                name || 'Unnamed Hall', 
                address || '', 
                city || 'Nizamabad', 
                cleanPrice, 
                description || '', 
                cleanLat, 
                cleanLng, 
                validImages, 
                cleanPackage, 
                owner_id,
                [] 
            ]
        );

        res.status(201).json(newHall.rows[0]);
    } catch (err) {
        console.error("Postgres Error Details:", err.message); 
        res.status(500).json({ error: err.message });
    }
});

app.put('/api/admin/halls/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, city, price, description, location_lat, location_lng, images, package_details } = req.body;

        const updatedHall = await pool.query(
            `UPDATE halls SET 
                name = $1, address = $2, city = $3, price = $4, description = $5, 
                location_lat = $6, location_lng = $7, images = $8, package_details = $9
            WHERE id = $10 RETURNING *`,
            [name, address, city, price, description, location_lat, location_lng, images, JSON.stringify(package_details), id]
        );

        if (updatedHall.rows.length === 0) {
            return res.status(404).json({ error: "Hall not found" });
        }

        res.json(updatedHall.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Update failed" });
    }
});

app.get('/api/halls/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const hall = await pool.query("SELECT * FROM halls WHERE id = $1", [id]);
        if (hall.rows.length === 0) {
            return res.status(404).json({ error: "Hall not found" });
        }
        res.json(hall.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "Server Error" });
    }
});

// --- BOOKING ROUTES ---

/**
 * Modified Booking Route:
 * Uses a Transaction to create a booking AND update the hall's booked_dates array.
 */
app.post('/api/bookings', async (req, res) => {
    const client = await pool.connect(); // Connect client for Transaction
    try {
        const { 
            hall_id, customer_name, customer_phone, selected_date, 
            price, amount_paid, payment_type, location_lat, location_lng 
        } = req.body;

        await client.query('BEGIN'); // Start Transaction

        // 1. Insert into Bookings Table
        const newBooking = await client.query(
            `INSERT INTO bookings (
                hall_id, customer_name, customer_phone, selected_date, 
                price, amount_paid, payment_type, location_lat, location_lng
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
            [
                hall_id, customer_name, customer_phone, selected_date, 
                price, amount_paid, payment_type, location_lat, location_lng
            ]
        );

        // 2. Update the Halls Table: Append the date to the booked_dates array
        await client.query(
            `UPDATE halls 
             SET booked_dates = array_append(booked_dates, $1) 
             WHERE id = $2`,
            [selected_date, hall_id]
        );

        await client.query('COMMIT'); // Commit the Transaction
        res.status(201).json(newBooking.rows[0]);

    } catch (err) {
        await client.query('ROLLBACK'); // Undo all changes if any part fails
        console.error("Booking Error:", err.message);
        res.status(500).json({ error: "Booking failed. The date might already be taken or server error." });
    } finally {
        client.release(); // Return client to pool
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});