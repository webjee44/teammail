import { useState, useRef } from "react";
import { Paperclip, Download, FileText, Image, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

type Attachment = {
  id: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function getIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return Image;
  return FileText;
}

export function AttachmentList({ attachments }: { attachments: Attachment[] }) {
  if (!attachments || attachments.length === 0) return null;

  const handleDownload = async (path: string, filename: string) => {
    const { data, error } = await supabase.storage
      .from("attachments")
      .createSignedUrl(path, 3600);
    if (error || !data?.signedUrl) return;
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-border">
      {attachments.map((att) => {
        const Icon = getIcon(att.mime_type);
        return (
          <button
            key={att.id}
            onClick={() => handleDownload(att.storage_path, att.filename)}
            className="flex items-center gap-1.5 px-2 py-1.5 rounded-md border border-border bg-muted/50 hover:bg-muted text-xs transition-colors group"
          >
            <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="truncate max-w-[140px] text-foreground">{att.filename}</span>
            <span className="text-muted-foreground shrink-0">{formatSize(att.size_bytes)}</span>
            <Download className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

export type FileToUpload = {
  file: File;
  name: string;
  base64: string;
};

export function AttachmentUpload({
  files,
  onFilesChange,
}: {
  files: FileToUpload[];
  onFilesChange: (files: FileToUpload[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setLoading(true);
    const newFiles: FileToUpload[] = [];
    for (const file of Array.from(fileList)) {
      if (file.size > 20 * 1024 * 1024) continue; // 20MB limit
      const base64 = await fileToBase64(file);
      newFiles.push({ file, name: file.name, base64 });
    }
    onFilesChange([...files, ...newFiles]);
    setLoading(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    onFilesChange(files.filter((_, i) => i !== index));
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="gap-1 text-muted-foreground h-7"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Paperclip className="h-3.5 w-3.5" />
          )}
          Joindre
        </Button>
        {files.map((f, i) => (
          <Badge key={i} variant="secondary" className="gap-1 text-xs pr-1">
            <FileText className="h-3 w-3" />
            <span className="truncate max-w-[120px]">{f.name}</span>
            <button onClick={() => removeFile(i)} className="ml-0.5 hover:text-destructive">
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data:...;base64, prefix
      resolve(result.split(",")[1] || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
