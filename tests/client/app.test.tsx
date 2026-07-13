// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../../client/src/App";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App", () => {
  it("renders the prompt forge workbench shell", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const path = String(input);
        if (path.includes("/api/providers")) return jsonResponse([]);
        if (path.includes("/api/history")) return jsonResponse([]);
        return jsonResponse({ error: "Unexpected request" }, 404);
      }),
    );

    render(<App />);

    expect(await screen.findByText("Prompt Forge")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /设置 API/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /锻造 System Prompt/ })).toBeDisabled();
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
