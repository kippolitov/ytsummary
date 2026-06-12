import { describe, it, expect, vi } from "vitest";
import type { HttpFunctionOptions, HttpResponseInit } from "@azure/functions";

vi.mock("@azure/functions", () => ({
  app: { http: vi.fn() },
}));

import { app } from "@azure/functions";
// importing the root entry registers both functions and their preflight routes
import "../../src/index";

function getRegistration(name: string): HttpFunctionOptions {
  const call = vi
    .mocked(app.http)
    .mock.calls.find(([registeredName]) => registeredName === name);
  if (!call) throw new Error(`function ${name} was not registered`);
  return call[1];
}

describe("function registrations", () => {
  it("registers the analyze and chat handlers on POST", () => {
    expect(getRegistration("analyze")).toMatchObject({ methods: ["POST"], route: "analyze" });
    expect(getRegistration("chat")).toMatchObject({ methods: ["POST"], route: "chat" });
  });

  it("registers anonymous OPTIONS preflight routes that answer 204 with CORS headers", async () => {
    for (const name of ["analyze-preflight", "chat-preflight"]) {
      const registration = getRegistration(name);
      expect(registration).toMatchObject({ methods: ["OPTIONS"], authLevel: "anonymous" });

      const response = (await registration.handler(
        {} as never,
        {} as never
      )) as HttpResponseInit;
      expect(response.status).toBe(204);
      expect((response.headers as Record<string, string>)["Access-Control-Allow-Origin"]).toBe("*");
    }
  });
});
