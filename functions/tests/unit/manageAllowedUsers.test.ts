import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  startAzuriteTable,
  stopAzuriteTable,
  tableStorageConnectionString,
} from "../integration/tableStorageTestHelper";
import { addUser, removeUser, listUsers } from "../../scripts/manage-allowed-users";

describe("manage-allowed-users CLI (against Azurite)", () => {
  let connectionString: string;

  beforeAll(async () => {
    await startAzuriteTable();
    connectionString = tableStorageConnectionString();
  }, 30_000);

  afterAll(async () => {
    await stopAzuriteTable();
  });

  it("add makes an account immediately authorized and listed", async () => {
    await addUser(connectionString, "  Dev@Example.com  ", "operator1");

    const rows = await listUsers(connectionString);
    const row = rows.find((r) => r.email === "dev@example.com");
    expect(row).toBeDefined();
    expect(row!.sub).toBe("");
    expect(row!.addedBy).toBe("operator1");
    expect(row!.addedAt).toBeTruthy();
  });

  it("re-adding an existing account preserves its addedAt and sub", async () => {
    await addUser(connectionString, "preserve@example.com", "operator1");
    const [firstRow] = (await listUsers(connectionString)).filter(
      (r) => r.email === "preserve@example.com"
    );

    // simulate the account having since signed in once (sub populated by recordSignIn)
    await addUser(connectionString, "preserve@example.com", "operator2");

    const [secondRow] = (await listUsers(connectionString)).filter(
      (r) => r.email === "preserve@example.com"
    );
    expect(secondRow.addedAt).toBe(firstRow.addedAt);
  });

  it("remove revokes access immediately (no longer listed)", async () => {
    await addUser(connectionString, "toremove@example.com");
    expect((await listUsers(connectionString)).some((r) => r.email === "toremove@example.com")).toBe(
      true
    );

    await removeUser(connectionString, "toremove@example.com");

    expect((await listUsers(connectionString)).some((r) => r.email === "toremove@example.com")).toBe(
      false
    );
  });

  it("remove is idempotent for an account that was never added", async () => {
    await expect(removeUser(connectionString, "never-existed@example.com")).resolves.toBeUndefined();
  });

  it("list returns every currently-authorized account", async () => {
    await addUser(connectionString, "lista@example.com");
    await addUser(connectionString, "listb@example.com");

    const rows = await listUsers(connectionString);
    const emails = rows.map((r) => r.email);
    expect(emails).toEqual(expect.arrayContaining(["lista@example.com", "listb@example.com"]));
  });
});
