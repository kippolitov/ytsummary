import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReferencesSection } from "../../components/sections/ReferencesSection";
import type { Reference } from "../../types/index";

const refsWithUrl: Reference[] = [
  {
    name: "LangChain",
    description: "A framework for building LLM applications.",
    url: "https://langchain.com",
    context: "Presenter says: 'We use LangChain to orchestrate calls.'",
  },
];

const refsWithoutUrl: Reference[] = [
  {
    name: "Attention Is All You Need",
    description: "The original transformer paper.",
    url: null,
    context: "Presenter cites it as the foundation of modern NLP.",
  },
];

describe("ReferencesSection", () => {
  it("renders a clickable link when URL is available", () => {
    render(<ReferencesSection references={refsWithUrl} />);
    const link = screen.getByRole("link", { name: /langchain/i });
    expect(link).toHaveAttribute("href", "https://langchain.com");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders plain name (no anchor) when URL is null", () => {
    render(<ReferencesSection references={refsWithoutUrl} />);
    expect(screen.getByText("Attention Is All You Need")).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("renders description and context", () => {
    render(<ReferencesSection references={refsWithUrl} />);
    expect(screen.getByText("A framework for building LLM applications.")).toBeInTheDocument();
    expect(screen.getByText(/We use LangChain/)).toBeInTheDocument();
  });

  it("renders nothing when references is empty", () => {
    const { container } = render(<ReferencesSection references={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
