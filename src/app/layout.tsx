import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TTB Label Verification",
  description:
    "AI-powered alcohol label verification tool for TTB compliance agents.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen antialiased">
        <header className="bg-[#1a4480] text-white shadow-md">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <h1 className="text-lg font-bold leading-tight tracking-tight">
              TTB Label Verification
            </h1>
            <p className="text-blue-200 text-xs mt-0.5">
              Alcohol and Tobacco Tax and Trade Bureau · Compliance Division
            </p>
          </div>
        </header>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
