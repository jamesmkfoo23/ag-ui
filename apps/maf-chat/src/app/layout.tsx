import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAF Chat – Microsoft Agent Framework",
  description: "AG-UI TypeScript SDK chat frontend for Microsoft Agent Framework Python agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
