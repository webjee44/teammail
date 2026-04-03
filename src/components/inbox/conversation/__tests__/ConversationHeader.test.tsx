import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConversationHeader } from "../ConversationHeader";
import type { ConversationDetailData } from "../types";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const baseConversation: ConversationDetailData = {
  id: "conv-1",
  subject: "Test Subject",
  from_email: "sender@example.com",
  from_name: "Sender",
  status: "open",
  assigned_to: null,
  messages: [],
  comments: [],
  priority: null,
  is_noise: false,
  ai_summary: null,
  category: null,
  entities: null,
};

describe("ConversationHeader", () => {
  const onReplyClick = vi.fn();
  const onStatusChange = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the subject", () => {
    render(
      <ConversationHeader
        conversation={baseConversation}
        onReplyClick={onReplyClick}
        onStatusChange={onStatusChange}
        onDelete={onDelete}
      />
    );
    expect(screen.getByText("Test Subject")).toBeInTheDocument();
  });

  it("renders status badge as Ouvert for open conversations", () => {
    render(
      <ConversationHeader conversation={baseConversation} onReplyClick={onReplyClick} />
    );
    expect(screen.getByText("Ouvert")).toBeInTheDocument();
  });

  it("renders status badge as En pause for snoozed conversations", () => {
    render(
      <ConversationHeader
        conversation={{ ...baseConversation, status: "snoozed" }}
        onReplyClick={onReplyClick}
      />
    );
    expect(screen.getByText("En pause")).toBeInTheDocument();
  });

  it("renders priority badge when set", () => {
    render(
      <ConversationHeader
        conversation={{ ...baseConversation, priority: "high" }}
        onReplyClick={onReplyClick}
      />
    );
    expect(screen.getByText("Haute")).toBeInTheDocument();
  });

  it("renders category badge when set", () => {
    render(
      <ConversationHeader
        conversation={{ ...baseConversation, category: "support" }}
        onReplyClick={onReplyClick}
      />
    );
    expect(screen.getByText("Support")).toBeInTheDocument();
  });

  it("renders noise badge when is_noise is true", () => {
    render(
      <ConversationHeader
        conversation={{ ...baseConversation, is_noise: true }}
        onReplyClick={onReplyClick}
      />
    );
    expect(screen.getByText("🔇 Bruit")).toBeInTheDocument();
  });

  it("renders tags", () => {
    render(
      <ConversationHeader
        conversation={{
          ...baseConversation,
          tags: [{ id: "t1", name: "Urgent", color: "#ff0000" }],
        }}
        onReplyClick={onReplyClick}
      />
    );
    expect(screen.getByText("Urgent")).toBeInTheDocument();
  });

  it("calls onReplyClick when Répondre button is clicked", () => {
    render(
      <ConversationHeader conversation={baseConversation} onReplyClick={onReplyClick} />
    );
    fireEvent.click(screen.getByText("Répondre"));
    expect(onReplyClick).toHaveBeenCalledTimes(1);
  });

  it("calls onDelete when Archiver button is clicked", () => {
    render(
      <ConversationHeader
        conversation={baseConversation}
        onReplyClick={onReplyClick}
        onDelete={onDelete}
      />
    );
    fireEvent.click(screen.getByText("Archiver"));
    expect(onDelete).toHaveBeenCalledWith("conv-1");
  });

  it("shows AI info collapsible when ai_summary is present", () => {
    render(
      <ConversationHeader
        conversation={{ ...baseConversation, ai_summary: "Summary text" }}
        onReplyClick={onReplyClick}
      />
    );
    expect(screen.getByText("Informations IA")).toBeInTheDocument();
  });

  it("enters editing mode on subject click", () => {
    render(
      <ConversationHeader conversation={baseConversation} onReplyClick={onReplyClick} />
    );
    fireEvent.click(screen.getByText("Test Subject"));
    const input = screen.getByDisplayValue("Test Subject");
    expect(input).toBeInTheDocument();
  });
});
