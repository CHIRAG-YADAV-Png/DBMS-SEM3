-- KeyTag (PostgreSQL version). Import into your existing database, e.g. defaultdb on Aiven.
-- Safe to run again: it first removes the old KeyTag tables (this deletes their data).
DROP TABLE IF EXISTS payment, rental, vehicle, customer, staff CASCADE;
DROP FUNCTION IF EXISTS rental_before_insert() CASCADE;
DROP FUNCTION IF EXISTS rental_after_insert() CASCADE;
DROP PROCEDURE IF EXISTS return_vehicle(INT);

CREATE TABLE staff (
  staff_id      SERIAL PRIMARY KEY,
  username      VARCHAR(30) UNIQUE NOT NULL,
  password_hash VARCHAR(100) NOT NULL
);

CREATE TABLE customer (
  customer_id SERIAL PRIMARY KEY,
  name        VARCHAR(60) NOT NULL,
  phone       VARCHAR(20) NOT NULL,
  license_no  VARCHAR(30) UNIQUE NOT NULL
);

CREATE TABLE vehicle (
  vehicle_id   SERIAL PRIMARY KEY,
  plate_no     VARCHAR(20) UNIQUE NOT NULL,
  name         VARCHAR(50) NOT NULL,
  type         VARCHAR(20) NOT NULL,
  seats        INT NOT NULL DEFAULT 5,
  rate_per_day NUMERIC(10,2) NOT NULL CHECK (rate_per_day > 0),
  status       VARCHAR(20) NOT NULL DEFAULT 'Available'
               CHECK (status IN ('Available','Rented','Maintenance'))
);

CREATE TABLE rental (
  rental_id    SERIAL PRIMARY KEY,
  vehicle_id   INT NOT NULL REFERENCES vehicle(vehicle_id),
  customer_id  INT NOT NULL REFERENCES customer(customer_id),
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  late_fee     NUMERIC(10,2) NOT NULL DEFAULT 0,
  status       VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active','Returned')),
  CONSTRAINT chk_dates CHECK (end_date > start_date)
);

CREATE TABLE payment (
  payment_id SERIAL PRIMARY KEY,
  rental_id  INT NOT NULL REFERENCES rental(rental_id),
  amount     NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  method     VARCHAR(10) NOT NULL CHECK (method IN ('Cash','UPI','Card')),
  paid_on    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger 1: block booking of a vehicle that is not available, and calculate the total
CREATE FUNCTION rental_before_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_status VARCHAR(20);
  v_rate   NUMERIC(10,2);
BEGIN
  SELECT status, rate_per_day INTO v_status, v_rate
    FROM vehicle WHERE vehicle_id = NEW.vehicle_id FOR UPDATE;
  IF v_status IS DISTINCT FROM 'Available' THEN
    RAISE EXCEPTION 'This vehicle is not available for rent.';
  END IF;
  NEW.total_amount := (NEW.end_date - NEW.start_date) * v_rate;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rental_before_insert BEFORE INSERT ON rental
  FOR EACH ROW EXECUTE FUNCTION rental_before_insert();

-- Trigger 2: mark the vehicle as Rented once the rental is saved
CREATE FUNCTION rental_after_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE vehicle SET status = 'Rented' WHERE vehicle_id = NEW.vehicle_id;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_rental_after_insert AFTER INSERT ON rental
  FOR EACH ROW EXECUTE FUNCTION rental_after_insert();

-- Stored procedure: return a vehicle, charge a late fee, free the vehicle
CREATE PROCEDURE return_vehicle(p_rental INT) LANGUAGE plpgsql AS $$
DECLARE
  v_id   INT;
  v_end  DATE;
  v_rate NUMERIC(10,2);
  v_late INT;
BEGIN
  SELECT vehicle_id, end_date INTO v_id, v_end FROM rental WHERE rental_id = p_rental AND status = 'Active';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'This rental is not active.';
  END IF;
  SELECT rate_per_day INTO v_rate FROM vehicle WHERE vehicle_id = v_id;
  v_late := GREATEST(CURRENT_DATE - v_end, 0);
  UPDATE rental SET status = 'Returned', late_fee = v_late * v_rate WHERE rental_id = p_rental;
  UPDATE vehicle SET status = 'Available' WHERE vehicle_id = v_id;
END $$;

-- Sample data
INSERT INTO vehicle (plate_no,name,type,seats,rate_per_day) VALUES
 ('HR 26 CX 4821','Maruti Swift','Hatchback',5,1800),
 ('DL 8C AB 1190','Hyundai Creta','SUV',5,3200),
 ('HR 55 AQ 7302','Toyota Innova','MPV',7,4200),
 ('DL 3S BN 5566','Royal Enfield Classic','Bike',2,900),
 ('HR 51 BK 2087','Honda City','Sedan',5,2800);

INSERT INTO customer (name,phone,license_no) VALUES
 ('Aarav Sharma','98100 11223','DL-0420110012345'),
 ('Priya Nair','98730 44556','HR-2620150098765'),
 ('Karan Mehta','99110 77889','DL-0820190054321');

INSERT INTO rental (vehicle_id,customer_id,start_date,end_date,status,late_fee) VALUES
 (1,2,CURRENT_DATE-12,CURRENT_DATE-9,'Returned',0),
 (3,3,CURRENT_DATE-8,CURRENT_DATE-5,'Returned',4200),
 (4,1,CURRENT_DATE-20,CURRENT_DATE-18,'Returned',0);
UPDATE vehicle SET status='Available';
INSERT INTO rental (vehicle_id,customer_id,start_date,end_date) VALUES
 (2,1,CURRENT_DATE-3,CURRENT_DATE+2);
UPDATE vehicle SET status='Maintenance' WHERE vehicle_id=5;

INSERT INTO payment (rental_id,amount,method) VALUES
 (1,5400,'UPI'),(2,16800,'Card'),(3,1800,'Cash'),(4,16000,'UPI');
