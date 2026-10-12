import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
  return <div className="markdown-body"><ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    img: ({ src, alt }) => <img src={src} alt={alt || "Gambar artikel"} loading="lazy" referrerPolicy="no-referrer" />,
    table: ({ children }) => <div className="markdown-table"><table>{children}</table></div>,
  }}>{children}</ReactMarkdown></div>;
}
