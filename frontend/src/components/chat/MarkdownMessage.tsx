import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

interface Props {
  children: string;
  className?: string;
}

/**
 * Render model-authored Markdown without enabling raw HTML.
 *
 * ReactMarkdown's default HTML handling is deliberately retained so chat
 * content cannot inject arbitrary DOM. The component overrides only visual
 * presentation and safe link behaviour.
 */
export function MarkdownMessage({ children, className }: Props) {
  return (
    <div
      className={cn(
        "max-w-prose break-words text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]",
        className,
      )}
    >
      <ReactMarkdown
        components={{
          p: ({ children: content }) => (
            <p className="mb-2 whitespace-pre-wrap last:mb-0">{content}</p>
          ),
          h1: ({ children: content }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0">{content}</h3>
          ),
          h2: ({ children: content }) => (
            <h3 className="mb-2 mt-3 text-base font-semibold first:mt-0">{content}</h3>
          ),
          h3: ({ children: content }) => (
            <h3 className="mb-2 mt-3 text-sm font-semibold first:mt-0">{content}</h3>
          ),
          hr: () => <hr className="my-3 border-border" />,
          ul: ({ children: content }) => (
            <ul className="mb-2 ml-5 list-disc space-y-1 last:mb-0">{content}</ul>
          ),
          ol: ({ children: content }) => (
            <ol className="mb-2 ml-5 list-decimal space-y-1 last:mb-0">{content}</ol>
          ),
          li: ({ children: content }) => <li className="pl-0.5">{content}</li>,
          blockquote: ({ children: content }) => (
            <blockquote className="my-2 border-l-2 border-brand/40 pl-3 text-muted-foreground">
              {content}
            </blockquote>
          ),
          a: ({ children: content, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="font-medium text-brand underline underline-offset-2 hover:text-brand/80"
            >
              {content}
            </a>
          ),
          pre: ({ children: content }) => (
            <pre className="my-2 max-w-full overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {content}
            </pre>
          ),
          code: ({ children: content }) => (
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]">{content}</code>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
