import TableServer from "azurite/dist/src/table/TableServer";
import TableConfiguration from "azurite/dist/src/table/TableConfiguration";

// Well-known Azurite/Storage Emulator development account — safe to hardcode,
// this key is published by Microsoft and only ever works against a local emulator.
const TEST_ACCOUNT_NAME = "devstoreaccount1";
const TEST_ACCOUNT_KEY =
  "Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==";
const TEST_HOST = "127.0.0.1";

let server: TableServer | null = null;
let endpoint = "";

/** Connection string integration tests can hand to @azure/data-tables' TableClient/fromConnectionString. */
export function tableStorageConnectionString(): string {
  return (
    `DefaultEndpointsProtocol=http;AccountName=${TEST_ACCOUNT_NAME};` +
    `AccountKey=${TEST_ACCOUNT_KEY};` +
    `TableEndpoint=${endpoint}/${TEST_ACCOUNT_NAME};`
  );
}

/**
 * Starts an in-memory Azurite Table Storage emulator instance for integration tests. Idempotent.
 * Binds to an OS-assigned port (0) — integration test files run concurrently in separate
 * workers, so a fixed port would collide across files.
 */
export async function startAzuriteTable(): Promise<void> {
  if (server) return;
  const config = new TableConfiguration(
    TEST_HOST,
    0,
    undefined,
    undefined,
    false,
    false,
    undefined,
    undefined,
    false,
    false,
    undefined,
    undefined,
    undefined,
    undefined,
    false,
    true // isMemoryPersistence — no on-disk metadata DB files
  );
  server = new TableServer(config);
  await server.start();
  endpoint = server.getHttpServerAddress();
}

/** Stops the Azurite Table Storage emulator instance started by startAzuriteTable(). Idempotent. */
export async function stopAzuriteTable(): Promise<void> {
  if (!server) return;
  await server.close();
  server = null;
}
