-- FILE: query_examples.sql
-- Dùng để test tính năng "Execute Selected Query"
-- Bôi đen từng đoạn lệnh dưới đây và nhấn Execute để chạy riêng lẻ.

    -- 1. Tạo bảng demo (Bôi đen đoạn này)
    CREATE TABLE IF NOT EXISTS demo_products (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        price DECIMAL(10, 2),
        stock INT DEFAULT 0
    );

    -- 2. Thêm dữ liệu (Bôi đen từng dòng để chạy)
    INSERT INTO demo_products (name, price, stock) VALUES ('Laptop Gaming', 1500.00, 10);
    INSERT INTO demo_products (name, price, stock) VALUES ('Mechanical Keyboard', 85.50, 50);
    INSERT INTO demo_products (name, price, stock) VALUES ('Curved Monitor', 300.00, 20);

    -- 3. Xem tất cả dữ liệu (Bôi đen dòng này)
    SELECT * FROM demo_products;

    -- 4. Xem hàng giá rẻ (Bôi đen dòng này)
    SELECT * FROM demo_products WHERE price < 100;

    -- 5. Cập nhật tồn kho (Bôi đen dòng này)
    UPDATE demo_products SET stock = stock - 1 WHERE name = 'Laptop Gaming';

    -- 6. Kiểm tra lại cập nhật (Bôi đen dòng này)
    SELECT * FROM demo_products WHERE name = 'Laptop Gaming';

    -- 7. Dọn dẹp bảng (Bôi đen dòng này)
    DROP TABLE demo_products;

    -- ==========================================
    -- 8. KẾT NỐI BẢNG (Create Relationships)
    -- ==========================================

    -- 8.1. Tạo bảng GIDO (Parent Table)
    CREATE TABLE IF NOT EXISTS gido (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL
    );

    -- 8.2. Thêm cột foreign key vào demo_products
    ALTER TABLE demo_products 
    ADD COLUMN IF NOT EXISTS gido_id INT;

    -- 8.3. Tạo liên kết khóa ngoại (Foreign Key)
    ALTER TABLE demo_products
    ADD CONSTRAINT fk_demo_products_gido
    FOREIGN KEY (gido_id) 
    REFERENCES gido(id)
    ON DELETE SET NULL; -- Hoặc CASCADE nếu muốn xóa cha mất con

    -- 8.4. Thêm dữ liệu mẫu cho GIDO
    INSERT INTO gido (name) VALUES ('Apple');
    INSERT INTO gido (name) VALUES ('Samsung');
    INSERT INTO gido (name) VALUES ('Logitech');

    -- 8.5. Cập nhật demo_products để nối với GIDO
    -- Gán Laptop Gaming (id=1) vào Samsung (giả sử id=2)
    UPDATE demo_products SET gido_id = 2 WHERE name = 'Laptop Gaming';
    
    -- Gán Mechanical Keyboard (id=2) vào Logitech (giả sử id=3)
    UPDATE demo_products SET gido_id = 3 WHERE name = 'Mechanical Keyboard';

    -- 8.6. Query kết hợp (JOIN) để kiểm tra
    SELECT p.name as Product, g.name as Brand, p.price
    FROM demo_products p
    LEFT JOIN gido g ON p.gido_id = g.id;
