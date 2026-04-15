import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MessageList } from "../MessageList";
import type { Message, Comment } from "../types";

// Mock supabase (needed by MentionTextarea)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          or: () => ({
            order: () => Promise.resolve({ data: [] }),
          }),
        }),
      }),
    }),
  },
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter>{children}</MemoryRouter>
);

const messages: Message[] = [
  {
    id: "msg-1",
    from_email: "alice@example.com",
    from_name: "Alice Dupont",
    to_email: "team@example.com",
    body_html: null,
    body_text: "Bonjour, j'ai un problème.",
    sent_at: "2026-04-01T10:00:00Z",
    is_outbound: false,
  },
  {
    id: "msg-2",
    from_email: "team@example.com",
    from_name: "Équipe Support",
    to_email: "alice@example.com",
    body_html: "<p>On s'en occupe !</p>",
    body_text: null,
    sent_at: "2026-04-01T11:00:00Z",
    is_outbound: true,
  },
];

const comments: Comment[] = [
  {
    id: "c-1",
    user_id: "u-1",
    body: "Pinger @Alice pour suivi",
    created_at: "2026-04-01T12:00:00Z",
    author_name: "Bob Martin",
  },
];

describe("MessageList", () => {
  it("renders all messages", () => {
    render(<MessageList messages={messages} comments={[]} />, { wrapper });
    expect(screen.getByText("Alice Dupont")).toBeInTheDocument();
    expect(screen.getByText("Bonjour, j'ai un problème.")).toBeInTheDocument();
    expect(screen.getByText("Équipe Support")).toBeInTheDocument();
  });

  it("renders HTML body when body_html is provided", () => {
    render(<MessageList messages={messages} comments={[]} />, { wrapper });
    expect(screen.getByText("On s'en occupe !")).toBeInTheDocument();
  });

  it("renders initials from from_name", () => {
    render(<MessageList messages={[messages[0]]} comments={[]} />, { wrapper });
    expect(screen.getByText("AD")).toBeInTheDocument();
  });

  it("renders initials from email when no from_name", () => {
    const noNameMsg: Message = {
      ...messages[0],
      id: "msg-no-name",
      from_name: null,
      from_email: "xyz@test.com",
    };
    render(<MessageList messages={[noNameMsg]} comments={[]} />, { wrapper });
    expect(screen.getByText("XY")).toBeInTheDocument();
  });

  it("renders comments section when comments exist", () => {
    render(<MessageList messages={[]} comments={comments} />, { wrapper });
    expect(screen.getByText("Notes internes")).toBeInTheDocument();
    expect(screen.getByText("Bob Martin")).toBeInTheDocument();
  });

  it("renders @mentions with styling in comments", () => {
    render(<MessageList messages={[]} comments={comments} />, { wrapper });
    const mention = screen.getByText("@Alice");
    expect(mention).toBeInTheDocument();
    expect(mention.className).toContain("text-primary");
  });

  it("does not render comments section when no comments", () => {
    render(<MessageList messages={messages} comments={[]} />, { wrapper });
    expect(screen.queryByText("Notes internes")).not.toBeInTheDocument();
  });

  it("renders outbound messages with ml-8 class", () => {
    const { container } = render(<MessageList messages={[messages[1]]} comments={[]} />, { wrapper });
    const msgDiv = container.querySelector(".ml-8");
    expect(msgDiv).toBeInTheDocument();
  });
});
