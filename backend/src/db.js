import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is missing. Add it to backend/.env");
}

function databaseConfig(value) {
  const local = /localhost|127\.0\.0\.1/.test(value);
  if (local) return { connectionString: value, ssl: false };
  const normalized = value.replace(
    /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/g,
    "$1sslmode=verify-full",
  );
  if (!/[?&]sslmode=/.test(normalized)) {
    return { connectionString: normalized, ssl: { rejectUnauthorized: false } };
  }
  return { connectionString: normalized };
}

export const pool = new pg.Pool(databaseConfig(connectionString));
