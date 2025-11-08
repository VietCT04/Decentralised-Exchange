import "./globals.css";
import { Inter } from "next/font/google";
import { WalletProvider } from "./providers/WalletProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "DEX MVP",
  description: "Issue ERC-20 and Create Orders",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-slate-950 text-slate-100`}>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  );
}
