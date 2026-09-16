import "./globals.css";
import BottomNav from "./components/BottomNav";
import { AuthProvider } from "./lib/AuthContext";
import { Archivo } from "next/font/google";

const displayFont = Archivo({ subsets: ["latin"], variable: "--font-display" });

export const metadata = {
  title: "Footy Hub",
  description: "Find and join football games near you",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={displayFont.variable}>
      <head>
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,600,800,700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-[#F7F3E9] text-[#1A1A1A] min-h-screen pb-24" style={{ fontFamily: "'General Sans', sans-serif" }}>
        <AuthProvider>
          {children}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
