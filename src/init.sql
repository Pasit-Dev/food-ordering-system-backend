CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS tables (
    table_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_number INT UNIQUE NOT NULL,
    table_status VARCHAR(10) CHECK (table_status IN ('Available', 'Occupied', 'Reserved')) NOT NULL
);

CREATE TABLE IF NOT EXISTS Menus (
    menu_id SERIAL PRIMARY KEY,
    menu_name VARCHAR(100) NOT NULL,
	menu_status VARCHAR(50) CHECK (menu_status IN ('Available', 'Unavailable')) NOT NULL DEFAULT 'Available',
    image TEXT,
    price INT NOT NULL
);

CREATE TABLE IF NOT EXISTS MenuGroups (
    menu_group_id SERIAL PRIMARY KEY,
    group_name VARCHAR(100) NOT NULL,
	is_required BOOLEAN NOT NULL DEFAULT false,
	is_multiple BOOLEAN NOT NULL DEFAULT false,
	menu_id INT REFERENCES Menus(menu_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS MenuOptions (
    menu_option_id SERIAL PRIMARY KEY,
    option_name VARCHAR(100) NOT NULL,
    additional_price INT NOT NULL DEFAULT 0,
	option_status VARCHAR(50) CHECK (option_status IN ('Available', 'Unavailable')) NOT NULL DEFAULT 'Available',
	menu_group_id INT REFERENCES MenuGroups(menu_group_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS Orders (
    order_id CHAR(8) PRIMARY KEY,
    order_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    payment_date TIMESTAMP WITH TIME ZONE,
    payment_method VARCHAR(50), -- Payment method (e.g., "Cash", "PromptPay", etc.)
    table_id UUID REFERENCES Tables(table_id) ON DELETE CASCADE,
    order_status VARCHAR(20) CHECK (order_status IN ('Not Paid', 'Paid', 'Cancelled')) NOT NULL DEFAULT 'Not Paid', -- Payment status
    order_type VARCHAR(20) CHECK (order_type IN ('Dine-in', 'Takeaway')) NOT NULL DEFAULT 'Dine-in', -- Type of order (Dine-in or Takeaway)
    customer_name TEXT
);

CREATE TABLE IF NOT EXISTS OrderItems (
    order_item_id SERIAL PRIMARY KEY,
	order_item_status VARCHAR(20) CHECK (order_item_status IN ('Pending', 'Preparing', 'Served', 'Cancelled')) NOT NULL DEFAULT 'Pending',
    order_id CHAR(8) REFERENCES Orders(order_id) ON DELETE CASCADE,
    menu_id INT REFERENCES Menus(menu_id),
    quantity INT NOT NULL DEFAULT 1,
    price INT NOT NULL,
	note TEXT,
	create_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS OrderItemOptions (
    order_item_id INT REFERENCES OrderItems(order_item_id) ON DELETE CASCADE,
    menu_option_id INT REFERENCES MenuOptions(menu_option_id) ON DELETE CASCADE,
    additional_price INT,
    PRIMARY KEY (order_item_id, menu_option_id)
);


CREATE TABLE IF NOT EXISTS OrderItemHistory (
    history_id SERIAL PRIMARY KEY,
    order_item_id INT REFERENCES OrderItems(order_item_id) ON DELETE CASCADE,
    previous_status VARCHAR(20) CHECK (previous_status IN ('Pending', 'Preparing', 'Served', 'Cancelled')),
    status VARCHAR(20) CHECK (status IN ('Pending', 'Preparing', 'Served', 'Cancelled')),
    change_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    changed_by VARCHAR(100) NOT NULL, -- ระบุชื่อหรือไอดีของผู้ทำการเปลี่ยนแปลง
    change_reason TEXT -- คำอธิบายการเปลี่ยนแปลง (ไม่บังคับ)
);
