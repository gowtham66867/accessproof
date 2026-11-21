import type { Metadata } from "next";
import "./globals.css";
import "./confirmation.css";
import "./improvements.css";

export const metadata: Metadata = {
  title: "AccessProof — Plan with evidence",
  description:
    "Compare venue accessibility with transparent, source-backed evidence.",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
