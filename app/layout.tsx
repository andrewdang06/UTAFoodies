import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "UTAFoodies - Mavs What To Eat",
  description: "Find the best food near UTA"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
