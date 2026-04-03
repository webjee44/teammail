import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type TeamMember = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
};

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
};

export function MentionTextarea({ value, onChange, placeholder, className, minHeight = "80px" }: Props) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStart, setMentionStart] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load team members once
  useEffect(() => {
    if (membersLoaded) return;
    const load = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, avatar_url");
      setMembers(data || []);
      setMembersLoaded(true);
    };
    load();
  }, [membersLoaded]);

  const filtered = members.filter((m) => {
    if (!mentionQuery) return true;
    const q = mentionQuery.toLowerCase();
    return (
      m.full_name?.toLowerCase().includes(q) ||
      m.email?.toLowerCase().includes(q)
    );
  });

  const computeDropdownPosition = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Create a mirror div to measure cursor position
    const mirror = document.createElement("div");
    const style = window.getComputedStyle(textarea);
    mirror.style.cssText = `
      position: absolute; visibility: hidden; white-space: pre-wrap; word-wrap: break-word;
      width: ${style.width}; font: ${style.font}; padding: ${style.padding};
      border: ${style.border}; line-height: ${style.lineHeight}; letter-spacing: ${style.letterSpacing};
    `;
    const textBefore = value.substring(0, textarea.selectionStart);
    mirror.textContent = textBefore;
    const span = document.createElement("span");
    span.textContent = "|";
    mirror.appendChild(span);
    document.body.appendChild(mirror);

    const rect = textarea.getBoundingClientRect();
    const spanRect = span.getBoundingClientRect();
    const mirrorRect = mirror.getBoundingClientRect();

    const top = spanRect.top - mirrorRect.top + parseInt(style.paddingTop) - textarea.scrollTop;
    const left = spanRect.left - mirrorRect.left + parseInt(style.paddingLeft);

    document.body.removeChild(mirror);

    // Position relative to textarea container
    setDropdownPos({
      top: Math.min(top + 20, textarea.offsetHeight),
      left: Math.min(left, textarea.offsetWidth - 200),
    });
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    onChange(newValue);

    // Detect @ trigger
    const textBeforeCursor = newValue.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex >= 0) {
      const charBefore = lastAtIndex > 0 ? textBeforeCursor[lastAtIndex - 1] : " ";
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasSpace = textAfterAt.includes(" ");

      if ((charBefore === " " || charBefore === "\n" || lastAtIndex === 0) && !hasSpace) {
        setShowDropdown(true);
        setMentionQuery(textAfterAt);
        setMentionStart(lastAtIndex);
        setSelectedIndex(0);
        setTimeout(computeDropdownPosition, 0);
        return;
      }
    }
    setShowDropdown(false);
    setMentionStart(null);
  };

  const insertMention = (member: TeamMember) => {
    if (mentionStart === null) return;
    const name = member.full_name || member.email || "?";
    const before = value.substring(0, mentionStart);
    const after = value.substring(mentionStart + 1 + mentionQuery.length);
    const newValue = `${before}@${name} ${after}`;
    onChange(newValue);
    setShowDropdown(false);
    setMentionStart(null);
    setMentionQuery("");

    // Refocus and set cursor
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        const pos = before.length + name.length + 2; // @name + space
        textarea.focus();
        textarea.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showDropdown || filtered.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(filtered[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        textareaRef.current &&
        !textareaRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{ minHeight }}
        className={cn(
          "flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none",
          className
        )}
      />
      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-56 rounded-md border bg-popover shadow-md overflow-hidden"
          style={{ top: dropdownPos.top, left: dropdownPos.left }}
        >
          <div className="max-h-40 overflow-y-auto py-1">
            {filtered.map((member, i) => {
              const initials = member.full_name
                ? member.full_name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
                : member.email?.slice(0, 2).toUpperCase() ?? "?";
              return (
                <button
                  key={member.user_id}
                  type="button"
                  className={cn(
                    "flex items-center gap-2 w-full px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors",
                    i === selectedIndex && "bg-accent"
                  )}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertMention(member);
                  }}
                  onMouseEnter={() => setSelectedIndex(i)}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={member.avatar_url ?? undefined} />
                    <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0">
                    <span className="font-medium truncate">{member.full_name || member.email}</span>
                    {member.full_name && member.email && (
                      <span className="text-xs text-muted-foreground truncate">{member.email}</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Renders text with @mentions highlighted.
 */
export function renderMentions(text: string) {
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("@") && part.length > 1) {
      return (
        <span key={i} className="text-primary font-medium bg-primary/10 rounded px-0.5">
          {part}
        </span>
      );
    }
    return part;
  });
}
