KeyTag – Vehicle Rental Management System

A web-based system for managing a vehicle rental business: fleet, customers, bookings, returns, payments and reports. Built as a Database Management Systems (DBMS) capstone project.

Live demo: https://keytag-delta.vercel.app/

What it does:-

1.Staff login with hashed passwords

2.Add vehicles, search and filter the fleet, send vehicles to maintenance

3.Add customers and view each customer's rental history

4.Book a vehicle with automatic price calculation (days × daily rate)

5.Return a vehicle with automatic late-fee calculation

6.Record payments (Cash, UPI, Card) and view printable receipts

7.Dashboard and reports: revenue by vehicle type, vehicle and payment method

8.Export rentals as CSV, light and dark theme, works on mobile

TECH STACK:-

Layer	Technology

Frontend	HTML, CSS, JavaScript

Backend	Node.js, Express

Database	PostgreSQL (Aiven free plan)

Security	bcryptjs, HMAC-signed login tokens

Hosting	Vercel (app), Aiven (database)

How it works:-

Browser (public/)  →  Express API (server.js)  →  PostgreSQL
   fetch() calls          SQL queries              tables, triggers,
                                                   stored procedure

The browser never talks to the database directly. The server holds the database credentials and runs parameterised SQL queries.

Database design:-

Tables: staff, customer, vehicle, rental, payment

Customer 1 → many Rentals; Vehicle 1 → many Rentals; Rental 1 → many Payments

Constraints: primary keys, foreign keys, UNIQUE (plate number, licence number, username), CHECK (rate > 0, end date after start date, valid statuses and payment methods)

Trigger 1 (BEFORE INSERT on rental): rejects booking a vehicle that is not available, locks the vehicle row, and calculates the total

Trigger 2 (AFTER INSERT on rental): marks the vehicle as Rented

Stored procedure return_vehicle: closes the rental, calculates the late fee, and frees the vehicle

Normalised to third normal form; payment status is calculated from the payment table

Project structure:-

├── database/schema.sql   tables, triggers, procedure, sample data

├── public/               frontend (index.html, style.css, script.js)

├── server.js             Express API and database connection

├── package.json

└── .env.example          template for environment variables

Run it locally

Install Node.js and create a PostgreSQL database (for example a free one on Aiven).

Clone the repository and install packages:

bash

cd Keytag

npm install

Create a .env file from .env.example:

DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require

TOKEN_SECRET=any-long-random-text

PORT=3000

Import database/schema.sql into your database (for example with psql, pgAdmin, or a small Node script).

Start the server:

bash

npm start

Open http://localhost:3000. The first start creates a default staff account; change its password before real use.

Deploy on Vercel

Push the project to GitHub (the .gitignore keeps .env and node_modules out).

Import the repository at vercel.com/new.

Add DATABASE_URL and TOKEN_SECRET under Environment Variables, then deploy.

API endpoints:-

Method	Route	Purpose

POST	/api/login	Check staff login, return a token

GET	/api/data	Vehicles, customers and rentals

POST	/api/vehicles	Add a vehicle

PATCH	/api/vehicles/:id/status	Maintenance on or off

POST	/api/customers	Add a customer

POST	/api/rentals	Create a rental (triggers run)

POST	/api/rentals/:id/return	Return a vehicle (stored procedure)

POST	/api/rentals/:id/payment	Record a payment

All routes except login need a valid token.

Limitations and future scope

Single staff role; no user management screen

A vehicle becomes Rented as soon as a rental is created, so advance reservations are not supported yet

No online payment gateway

Author:-
Chirag Yadav


