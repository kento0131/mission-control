import type { Metadata } from "next";
import "./globals.css";
import { ConvexClientProvider } from "./providers";
import { NavBar } from "./components/NavBar";

export const metadata: Metadata = {
  title: "Mission Control",
  description: "OpenClaw AI Agent Dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>
          <NavBar />
          <main style={{ padding: "1.5rem" }}>{children}</main>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
