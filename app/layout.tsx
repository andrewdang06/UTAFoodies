import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MavEats — UTA Student Food Finder",
  description: "The smartest way to find food near UTA. Built for Mavericks."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
