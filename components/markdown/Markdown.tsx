"use client";

import { useState, type ReactNode } from "react";

/**
 * Renderizador de markdown minimalista (sin dependencias) para la prosa de
 * Astralys. Soporta: encabezados, negrita/cursiva, código, enlaces, listas,
 * citas, separadores, tablas y spoilers ocultables (`||texto||`).
 */
export function Markdown({ source, className }: { source: string | null | undefined; className?: string }) {
  if (!source || !source.trim()) return null;
  return <div className={className}>{renderBlocks(source)}</div>;
}

function renderBlocks(src: string): ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // separador
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-6 border-border-base" />);
      i++;
      continue;
    }

    // encabezados
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const cls =
        level === 1
          ? "mt-6 mb-2 font-display text-2xl text-accent"
          : level === 2
            ? "mt-5 mb-2 font-display text-xl text-accent"
            : "mt-4 mb-1 font-display text-lg text-secondary";
      const Tag = (`h${Math.min(level + 1, 6)}`) as "h2";
      blocks.push(
        <Tag key={key++} className={cls}>
          {renderInline(h[2])}
        </Tag>,
      );
      i++;
      continue;
    }

    // cita
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="my-4 border-l-2 border-primary/60 pl-4 italic text-fg-secondary"
        >
          {renderInline(quote.join(" "))}
        </blockquote>,
      );
      continue;
    }

    // tabla (línea con | seguida de separador |---|)
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={key++} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                {header.map((c, idx) => (
                  <th key={idx} className="border border-border-base bg-surface/60 px-3 py-1.5 text-left font-display text-secondary">
                    {renderInline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border border-border-base px-3 py-1.5 text-fg-secondary">
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // listas
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-3 list-disc space-y-1 pl-6 text-fg-secondary">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="my-3 list-decimal space-y-1 pl-6 text-fg-secondary">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // párrafo (acumula líneas hasta blanco)
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>\s?|---+$|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) {
      para.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key++} className="my-3 leading-relaxed text-fg-secondary">
        {renderInline(para.join(" "))}
      </p>,
    );
  }

  return blocks;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

/** Inline: spoiler, negrita, cursiva, código, enlaces. */
function renderInline(text: string): ReactNode[] {
  // El spoiler se procesa primero porque envuelve componente interactivo.
  const parts: ReactNode[] = [];
  const spoilerRe = /\|\|([\s\S]+?)\|\|/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = spoilerRe.exec(text))) {
    if (m.index > last) parts.push(...renderEmphasis(text.slice(last, m.index), key++));
    parts.push(<Spoiler key={`sp-${key++}`}>{renderEmphasis(m[1], key++)}</Spoiler>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(...renderEmphasis(text.slice(last), key++));
  return parts;
}

function renderEmphasis(text: string, baseKey: number): ReactNode[] {
  const tokenRe = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let k = 0;
  while ((m = tokenRe.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${baseKey}-${k++}`;
    if (tok.startsWith("**") || tok.startsWith("__")) {
      out.push(<strong key={key} className="font-semibold text-fg">{tok.slice(2, -2)}</strong>);
    } else if (tok.startsWith("`")) {
      out.push(<code key={key} className="rounded bg-surface px-1 font-mono text-sm text-accent">{tok.slice(1, -1)}</code>);
    } else if (tok.startsWith("[")) {
      const lm = /\[([^\]]+)\]\(([^)]+)\)/.exec(tok);
      if (lm) out.push(<a key={key} href={lm[2]} className="text-primary underline hover:text-primary-glow">{lm[1]}</a>);
    } else {
      out.push(<em key={key} className="italic">{tok.slice(1, -1)}</em>);
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function Spoiler({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setShown((v) => !v)}
      className={
        shown
          ? "rounded bg-surface/60 px-1"
          : "rounded bg-fg-muted/30 px-1 text-transparent select-none [text-shadow:0_0_8px_rgba(255,255,255,.5)]"
      }
      title={shown ? "Ocultar" : "Revelar spoiler"}
    >
      {children}
    </button>
  );
}
