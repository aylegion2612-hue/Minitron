import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { applySchema } from "./schema";

const dataDir = path.resolve(process.cwd(), "data");
fs.mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "db.sqlite");
const db = new Database(dbPath);

applySchema(db);

export { db };
