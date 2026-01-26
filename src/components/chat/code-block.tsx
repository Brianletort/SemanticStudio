"use client";

import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CodeBlockProps {
  language?: string;
  children: string;
}

export function CodeBlock({ language, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Clean up the language string (react-markdown passes "language-python" format)
  const lang = language?.replace(/^language-/, "") || "text";

  return (
    <div className="relative group my-4 rounded-lg border border-border w-full bg-[#282c34]">
      {/* Header with language label and copy button */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/80 border-b border-border rounded-t-lg">
        <span className="text-xs font-medium text-muted-foreground uppercase">
          {lang}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-60 hover:opacity-100"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>
      
      {/* Code content with syntax highlighting */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={lang}
          style={oneDark}
          customStyle={{
            margin: 0,
            padding: "1rem",
            background: "transparent",
            fontSize: "0.875rem",
            overflowX: "auto",
          }}
          codeTagProps={{
            style: {
              fontFamily: "var(--font-geist-mono), monospace",
              whiteSpace: "pre",
              display: "block",
            },
          }}
          wrapLongLines={false}
          PreTag="div"
        >
          {children.trim()}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
