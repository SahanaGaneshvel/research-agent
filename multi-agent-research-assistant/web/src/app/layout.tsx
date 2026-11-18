import type { Metadata } from "next";
import { Google_Sans } from "next/font/google";
import "./globals.css";

// Brand typeface (brand guidelines, section 3): Google Sans 400 / 500 / 600 / 700.
const googleSans = Google_Sans({ variable: "--font-google-sans", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Research Agents · GenAI Protos",
  description:
    "A GenAI Protos proof of concept: four AI agents research a technical question on a local model and write a cited report, with plain code checking every fact.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${googleSans.variable} antialiased`}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
