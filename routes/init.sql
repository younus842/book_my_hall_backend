-- Create Halls Table (Removed created_at)
CREATE TABLE IF NOT EXISTS halls (
    id SERIAL PRIMARY KEY,
    owner_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) DEFAULT 'Nizamabad',
    address TEXT,
    price DECIMAL(12, 2), -- Current listing price
    description TEXT,
    location_lat DECIMAL(9, 6),
    location_lng DECIMAL(9, 6),
    images TEXT[], 
    booked_dates DATE[] DEFAULT '{}',
    package_details JSONB
);

-- Create Bookings Table (Added price, latitude, longitude, and selected_date)
CREATE TABLE IF NOT EXISTS bookings (
    id SERIAL PRIMARY KEY,
    hall_id INT REFERENCES halls(id) ON DELETE CASCADE,
    customer_name VARCHAR(255) NOT NULL,
    customer_phone VARCHAR(20),
    
    -- Date Management
    selected_date DATE NOT NULL, -- The specific day the hall is blocked for
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP, -- Tracking when booking was made
    
    -- Financials
    price DECIMAL(12, 2), -- The total price agreed upon for this specific booking
    amount_paid DECIMAL(10, 2), -- The advance (e.g., the 300rs platform fee or 6000rs cash)
    status VARCHAR(50) DEFAULT 'confirmed',
    payment_type VARCHAR(20), -- 'online' or 'cash'
    
    -- Location tracking for the booking event
    location_lat DECIMAL(9, 6),
    location_lng DECIMAL(9, 6)
);

ALTER TABLE bookings ADD CONSTRAINT unique_hall_date UNIQUE (hall_id, selected_date);