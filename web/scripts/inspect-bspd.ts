import { readFileSync } from "fs";
import { MongoClient } from "mongodb";

const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const [key, ...rest] = line.split("=");
  if (key && rest.length) process.env[key.trim()] = rest.join("=").trim();
}

const uri = process.env.NUXT_DONO_MONGODB_URI!;

async function inspect() {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("DonoUtilities");
  const doc = await db.collection("DonoUtilities_Bspd").findOne({});
  console.log("Sample BSPD doc keys:", Object.keys(doc || {}));
  console.log("Sample doc:", JSON.stringify(doc, null, 2).slice(0, 2000));
  await client.close();
}

inspect();
