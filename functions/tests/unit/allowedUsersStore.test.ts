import { describe, it, expect, vi, beforeEach } from "vitest";
import { RestError } from "@azure/data-tables";

const getEntity = vi.fn();
const updateEntity = vi.fn();

vi.mock("@azure/data-tables", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@azure/data-tables")>();
  return {
    ...actual,
    TableClient: {
      fromConnectionString: vi.fn(() => ({ getEntity, updateEntity })),
    },
  };
});

import { isAllowed, recordSignIn } from "../../src/services/allowedUsersStore";

function notFoundError(): RestError {
  return new RestError("not found", { statusCode: 404 });
}

describe("allowedUsersStore", () => {
  beforeEach(() => {
    getEntity.mockReset();
    updateEntity.mockReset();
  });

  describe("isAllowed", () => {
    it("returns true when a row exists for the lowercased/trimmed email", async () => {
      getEntity.mockResolvedValue({ partitionKey: "AllowedUser", rowKey: "user@example.com" });

      const result = await isAllowed("  User@Example.com  ");

      expect(result).toBe(true);
      expect(getEntity).toHaveBeenCalledWith("AllowedUser", "user@example.com");
    });

    it("returns false when the row is absent (404)", async () => {
      getEntity.mockRejectedValue(notFoundError());

      const result = await isAllowed("nobody@example.com");

      expect(result).toBe(false);
    });

    it("rethrows non-404 errors", async () => {
      getEntity.mockRejectedValue(new RestError("boom", { statusCode: 500 }));

      await expect(isAllowed("x@example.com")).rejects.toThrow("boom");
    });
  });

  describe("recordSignIn", () => {
    it("populates sub on an account's first successful sign-in", async () => {
      getEntity.mockResolvedValue({ partitionKey: "AllowedUser", rowKey: "user@example.com" });
      updateEntity.mockResolvedValue(undefined);

      await recordSignIn("User@Example.com", "sub-123");

      expect(updateEntity).toHaveBeenCalledWith(
        { partitionKey: "AllowedUser", rowKey: "user@example.com", sub: "sub-123" },
        "Merge"
      );
    });

    it("does not overwrite an already-populated sub", async () => {
      getEntity.mockResolvedValue({
        partitionKey: "AllowedUser",
        rowKey: "user@example.com",
        sub: "existing-sub",
      });

      await recordSignIn("user@example.com", "new-sub");

      expect(updateEntity).not.toHaveBeenCalled();
    });

    it("no-ops when the account is not in AllowedUsers", async () => {
      getEntity.mockRejectedValue(notFoundError());

      await recordSignIn("nobody@example.com", "sub-123");

      expect(updateEntity).not.toHaveBeenCalled();
    });
  });
});
