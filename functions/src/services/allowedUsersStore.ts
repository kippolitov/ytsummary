import { TableClient, RestError } from "@azure/data-tables";

const TABLE_NAME = "AllowedUsers";
const PARTITION_KEY = "AllowedUser";

let client: TableClient | null = null;

function getClient(): TableClient {
  if (!client) {
    const connectionString = process.env.AzureWebJobsStorage ?? "";
    client = TableClient.fromConnectionString(connectionString, TABLE_NAME, {
      allowInsecureConnection: true,
    });
  }
  return client;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True if `email` (case/whitespace-insensitive) has a row in the AllowedUsers table. */
export async function isAllowed(email: string): Promise<boolean> {
  try {
    await getClient().getEntity(PARTITION_KEY, normalizeEmail(email));
    return true;
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) return false;
    throw err;
  }
}

/**
 * Populates the `sub` column on an account's first successful sign-in
 * (data-model.md: AllowedUsers.sub is empty until then). No-ops if the
 * account isn't allowed, or already has a `sub` recorded.
 */
export async function recordSignIn(email: string, sub: string): Promise<void> {
  const rowKey = normalizeEmail(email);
  let entity: Record<string, unknown>;
  try {
    entity = await getClient().getEntity(PARTITION_KEY, rowKey);
  } catch (err) {
    if (err instanceof RestError && err.statusCode === 404) return;
    throw err;
  }
  if (entity.sub) return;
  await getClient().updateEntity(
    { partitionKey: PARTITION_KEY, rowKey, sub },
    "Merge"
  );
}
