import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const spaceGrotesk = localFont({
  src: [{ path: "./fonts/spacegrotesk.ttf", style: "normal" }],
  variable: "--font-display",
  display: "swap",
});

const inter = localFont({
  src: [{ path: "./fonts/inter.ttf", style: "normal" }],
  variable: "--font-body",
  display: "swap",
});

const plexMono = localFont({
  src: [
    {
      path: "./fonts/plexmono-regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/plexmono-medium.ttf",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wireroom — The AI newsroom that never sleeps",
  description:
    "Give it a topic. Wireroom's research, writing, editing and publishing agents take it from idea to a live article on your site.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col bg-void text-ink font-body antialiased">
        {children}
      </body>
    </html>
  );
}