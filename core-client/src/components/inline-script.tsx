"use client";

type InlineScriptProps = Readonly<{
  html: string;
  id?: string;
}>;

export function InlineScript({ html, id }: InlineScriptProps) {
  return (
    <script
      id={id}
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
