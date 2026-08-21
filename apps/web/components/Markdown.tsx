import { Fragment, type ReactNode } from "react";

/**
 * A very small Markdown renderer for the covenant terms.
 *
 * It handles headings, paragraphs, lists, rules, bold, italic and links, and
 * nothing else.
 * It builds React elements rather than HTML strings — the terms are our own
 * file, but a legal document is the last place to introduce a
 * `dangerouslySetInnerHTML`, and a reviewer should be able to see that at a
 * glance.
 *
 * HTML comments are stripped, which is how the `<!-- REVIEW: legal -->` marker
 * stays in the source without reaching a reader.
 */

/**
 * Inline marks: bold and links.
 *
 * Links are built as elements, never as an href interpolated into raw HTML, and
 * anything that is not http(s) or mailto is rendered as plain text. These files
 * are ours, but a privacy policy is the last document to give a
 * `dangerouslySetInnerHTML` to, and a reviewer should see that at a glance.
 */
function safeHref(href: string): string | null {
  const trimmed = href.trim();
  return /^(https?:\/\/|mailto:|\/)/i.test(trimmed) ? trimmed : null;
}

function inline(text: string, keyPrefix: string): ReactNode[] {
  // Ordered: bold before italic, so `**x**` is not read as `*` + `*x*`.
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g);

  return parts.map((chunk, index) => {
    const key = `${keyPrefix}-${index}`;

    // Recursive, so `**[Vercel](https://…)**` renders as a bold link rather
    // than as literal markup.
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      return <strong key={key}>{inline(chunk.slice(2, -2), `${key}-b`)}</strong>;
    }

    if (chunk.startsWith("*") && chunk.endsWith("*") && chunk.length > 2) {
      return <em key={key}>{inline(chunk.slice(1, -1), `${key}-i`)}</em>;
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(chunk);
    if (link) {
      const [, label, href] = link;
      const safe = safeHref(href as string);
      if (!safe) return <Fragment key={key}>{label}</Fragment>;
      const external = safe.startsWith("http");
      return (
        <a
          key={key}
          href={safe}
          className="text-steel underline-offset-4 hover:underline"
          {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
        >
          {label}
        </a>
      );
    }

    return <Fragment key={key}>{chunk}</Fragment>;
  });
}

export function Markdown({ source, className = "" }: { source: string; className?: string }) {
  const body = source.replace(/<!--[\s\S]*?-->/g, "");
  const lines = body.split("\n");

  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  function flushParagraph() {
    if (paragraph.length === 0) return;
    const key = `p-${blocks.length}`;
    blocks.push(<p key={key}>{inline(paragraph.join(" "), key)}</p>);
    paragraph = [];
  }

  function flushList() {
    if (list.length === 0) return;
    const key = `ul-${blocks.length}`;
    blocks.push(
      <ul key={key}>
        {list.map((item, index) => (
          <li key={`${key}-${index}`}>{inline(item, `${key}-${index}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  }

  function flush() {
    flushParagraph();
    flushList();
  }

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (line.trim() === "") {
      flush();
      continue;
    }

    if (line.startsWith("### ")) {
      flush();
      blocks.push(<h3 key={`h3-${blocks.length}`}>{inline(line.slice(4), `h3-${blocks.length}`)}</h3>);
      continue;
    }
    if (line.startsWith("## ")) {
      flush();
      blocks.push(<h2 key={`h2-${blocks.length}`}>{inline(line.slice(3), `h2-${blocks.length}`)}</h2>);
      continue;
    }
    if (line.startsWith("# ")) {
      flush();
      blocks.push(<h1 key={`h1-${blocks.length}`}>{inline(line.slice(2), `h1-${blocks.length}`)}</h1>);
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flush();
      blocks.push(<hr key={`hr-${blocks.length}`} />);
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      list.push(line.slice(2));
      continue;
    }

    // A wrapped list item: indented, with a list open. Without this the list is
    // closed mid-item and the remainder becomes a paragraph glued to the text
    // before it.
    if (list.length > 0 && /^\s+\S/.test(raw)) {
      list[list.length - 1] = `${list[list.length - 1]} ${line.trim()}`;
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flush();

  return <div className={`prose-plain text-muted ${className}`}>{blocks}</div>;
}
