/* eslint-disable no-console -- this is a CLI's own stdout, not an Azure Function (which uses context.log). */
import { TableClient, RestError } from "@azure/data-tables";

const TABLE_NAME = "AllowedUsers";
const PARTITION_KEY = "AllowedUser";

export interface AllowedUserRow {
  email: string;
  sub: string;
  addedAt: string;
  addedBy: string;
}

function getClient(connectionString: string): TableClient {
  return TableClient.fromConnectionString(connectionString, TABLE_NAME, {
    allowInsecureConnection: true,
  });
}

async function ensureTable(client: TableClient): Promise<void> {
  try {
    await client.createTable();
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 409) return;
    throw err;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Adds (or re-adds) an account to AllowedUsers. Idempotent — re-adding preserves the existing sub/addedAt. */
export async function addUser(
  connectionString: string,
  email: string,
  addedBy = ""
): Promise<void> {
  const client = getClient(connectionString);
  await ensureTable(client);
  const rowKey = normalizeEmail(email);

  let existing: Record<string, unknown> | null = null;
  try {
    existing = await client.getEntity(PARTITION_KEY, rowKey);
  } catch (err) {
    if (!(err instanceof RestError && err.statusCode === 404)) throw err;
  }

  await client.upsertEntity(
    {
      partitionKey: PARTITION_KEY,
      rowKey,
      sub: (existing?.sub as string | undefined) ?? "",
      addedAt: (existing?.addedAt as string | undefined) ?? new Date().toISOString(),
      addedBy: addedBy || ((existing?.addedBy as string | undefined) ?? ""),
    },
    "Replace"
  );
}

/** Removes an account from AllowedUsers — access is revoked on its next request. Idempotent. */
export async function removeUser(connectionString: string, email: string): Promise<void> {
  const client = getClient(connectionString);
  await ensureTable(client);
  try {
    await client.deleteEntity(PARTITION_KEY, normalizeEmail(email));
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) return;
    throw err;
  }
}

/** Lists every authorized account. */
export async function listUsers(connectionString: string): Promise<AllowedUserRow[]> {
  const client = getClient(connectionString);
  await ensureTable(client);
  const rows: AllowedUserRow[] = [];
  const iter = client.listEntities({
    queryOptions: { filter: `PartitionKey eq '${PARTITION_KEY}'` },
  });
  for await (const entity of iter) {
    rows.push({
      email: entity.rowKey as string,
      sub: (entity.sub as string | undefined) ?? "",
      addedAt: (entity.addedAt as string | undefined) ?? "",
      addedBy: (entity.addedBy as string | undefined) ?? "",
    });
  }
  return rows;
}

async function main(): Promise<void> {
  const [, , command, email] = process.argv;
  const connectionString = process.env.AzureWebJobsStorage;

  if (!connectionString) {
    console.error("AzureWebJobsStorage is not set. Run this from functions/ with your local.settings.json values exported, or set it directly.");
    process.exitCode = 1;
    return;
  }

  if (command === "add" && email) {
    await addUser(connectionString, email, process.env.USER ?? process.env.USERNAME ?? "");
    console.log(`Added ${normalizeEmail(email)} to AllowedUsers.`);
    return;
  }

  if (command === "remove" && email) {
    await removeUser(connectionString, email);
    console.log(`Removed ${normalizeEmail(email)} from AllowedUsers.`);
    return;
  }

  if (command === "list") {
    const rows = await listUsers(connectionString);
    if (rows.length === 0) {
      console.log("No allowed users.");
    } else {
      for (const row of rows) {
        console.log(`${row.email}\tsub=${row.sub || "(none)"}\taddedAt=${row.addedAt}\taddedBy=${row.addedBy}`);
      }
    }
    return;
  }

  console.error("Usage: npm run allowed-users -- <add|remove> <email> | npm run allowed-users -- list");
  process.exitCode = 1;
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
