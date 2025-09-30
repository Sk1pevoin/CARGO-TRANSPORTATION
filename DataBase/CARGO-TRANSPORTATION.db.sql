BEGIN TRANSACTION;
CREATE TABLE IF NOT EXISTS "bid" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"wherefrom"	TEXT,
	"towhere"	TEXT,
	"status"	TEXT,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "client_auth" (
	"id"	INTEGER,
	"login"	TEXT NOT NULL UNIQUE,
	"password"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "client_registr" (
	"id"	INTEGER,
	"login"	TEXT NOT NULL UNIQUE,
	"password"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "contacts" (
	"id"	INTEGER,
	"phone"	TEXT NOT NULL,
	"email"	TEXT NOT NULL,
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "drivers" (
	"id"	INTEGER,
	"name"	TEXT NOT NULL,
	"phone"	TEXT,
	"license_number"	TEXT UNIQUE,
	"status"	TEXT DEFAULT 'available',
	PRIMARY KEY("id" AUTOINCREMENT)
);
CREATE TABLE IF NOT EXISTS "trucks" (
	"id"	INTEGER,
	"model"	TEXT NOT NULL,
	"license_plate"	TEXT UNIQUE,
	"capacity_kg"	REAL,
	"status"	TEXT DEFAULT 'available',
	PRIMARY KEY("id" AUTOINCREMENT)
);
COMMIT;
