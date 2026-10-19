import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "লাইফলুপ | আপনার স্বাস্থ্যের সহজ হিসাব",
  description: "রক্তে শর্করা ও রক্তচাপের তথ্য গুছিয়ে রাখুন, নিজের পরিবর্তন বুঝুন এবং চিকিৎসকের সঙ্গে কথা বলার প্রস্তুতি নিন।",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="bn-BD"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
