import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ReplyArea } from "../ReplyArea";
import type { ConversationDetailData } from "../types";

// Mock supabase
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: null }),
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: null }),
          }),
        }),
      }),
    }),
    functions: {
      invoke: vi.fn(() => Promise.resolve({ data: { suggestions: [] }, error: null })),
    },
    auth: {
      getUser: () => Promise.resolve({ data: { user: { id: "u-1" } } }),
    },
  },
}));

vi.mock("@/hooks/useDraft", () => ({
  useDraft: () => ({
    draft: { body: "" },
    updateDraft: vi.fn(),
    deleteDraft: vi.fn(() => Promise.resolve()),
    loading: false,
  }),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const conversation: ConversationDetailData = {
  id: "conv-1",
  subject: "Test Subject",
  from_email: "sender@example.com",
  from_name: "Sender",
  status: "open",
  assigned_to: null,
  messages: [
    {
      id: "msg-1",
      from_email: "sender@example.com",
      from_name: "Sender",
      to_email: "team@example.com",
      body_html: null,
      body_text: "Hello",
      sent_at: "2026-04-01T10:00:00Z",
      is_outbound: false,
    },
  ],
  comments: [],
};

describe("ReplyArea", () => {
  const onReply = vi.fn();
  const onComment = vi.fn();
  const onActiveTabChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders reply and comment tabs", () => {
    render(
      <ReplyArea
        conversation={conversation}
        activeTab="reply"
        onActiveTabChange={onActiveTabChange}
        onReply={onReply}
        onComment={onComment}
      />
    );
    expect(screen.getByText("Répondre")).toBeInTheDocument();
    expect(screen.getByText("Note interne")).toBeInTheDocument();
  });

  it("renders reply textarea with placeholder", () => {
    render(
      <ReplyArea
        conversation={conversation}
        activeTab="reply"
        onActiveTabChange={onActiveTabChange}
      />
    );
    expect(screen.getByPlaceholderText("Tapez votre réponse... (@mention pour taguer)")).toBeInTheDocument();
  });

  it("disables Envoyer button when reply text is empty", () => {
    render(
      <ReplyArea
        conversation={conversation}
        activeTab="reply"
        onActiveTabChange={onActiveTabChange}
      />
    );
    const sendBtn = screen.getByText("Envoyer").closest("button");
    expect(sendBtn).toBeDisabled();
  });

  it("enables Envoyer button when text is typed", () => {
    render(
      <ReplyArea
        conversation={conversation}
        activeTab="reply"
        onActiveTabChange={onActiveTabChange}
        onReply={onReply}
      />
    );
    const textarea = screen.getByPlaceholderText("Tapez votre réponse... (@mention pour taguer)");
    fireEvent.change(textarea, { target: { value: "Ma réponse" } });
    const sendBtn = screen.getByText("Envoyer").closest("button");
    expect(sendBtn).not.toBeDisabled();
  });

  it("renders Suggérer and Template buttons", () => {
    render(
      <ReplyArea
        conversation={conversation}
        activeTab="reply"
        onActiveTabChange={onActiveTabChange}
      />
    );
    expect(screen.getByText("Suggérer")).toBeInTheDocument();
    expect(screen.getByText("Template")).toBeInTheDocument();
  });

  it("renders Plus tard button", () => {
    render(
      <ReplyArea
        conversation={conversation}
        activeTab="reply"
        onActiveTabChange={onActiveTabChange}
      />
    );
    expect(screen.getByText("Plus tard")).toBeInTheDocument();
  });

  it("shows comment tab content when activeTab is comment", () => {
    render(
      <ReplyArea
        conversation={conversation}
        activeTab="comment"
        onActiveTabChange={onActiveTabChange}
        onComment={onComment}
      />
    );
    expect(screen.getByPlaceholderText("Ajouter une note interne... (@mention pour taguer)")).toBeInTheDocument();
    expect(screen.getByText("Ajouter note")).toBeInTheDocument();
  });

  it("disables Ajouter note when comment text is empty", () => {
    render(
      <ReplyArea
        conversation={conversation}
        activeTab="comment"
        onActiveTabChange={onActiveTabChange}
        onComment={onComment}
      />
    );
    const btn = screen.getByText("Ajouter note").closest("button");
    expect(btn).toBeDisabled();
  });
});
