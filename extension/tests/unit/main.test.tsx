import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

vi.mock("../../components/Chat/ChatPanel", () => ({
  ChatPanel: () => <div data-testid="chat-panel" />,
}));

describe("sidepanel main bootstrap", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    document.body.innerHTML = '<div id="root"></div>';
    (chrome.storage.session.get as ReturnType<typeof vi.fn>).mockResolvedValue({});
  });

  it("mounts the App into #root and applies the light theme by default", async () => {
    await import("../../entrypoints/sidepanel/main");

    await waitFor(() =>
      expect(document.getElementById("root")!.innerHTML).not.toBe("")
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });
});
