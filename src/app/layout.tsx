import "./globals.css";
import TeleIntro from "@/components/TeleIntro";
import ActiveSurfaceHost from "@/ui/ActiveSurfaceHost";
import ActiveSurfaceDevOverlay from "@/ui/ActiveSurfaceDevOverlay";
import { TeleToastHost } from "@/ui/TeleToastHost";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <TeleIntro />
        <ActiveSurfaceHost />
        <ActiveSurfaceDevOverlay />
        <TeleToastHost />
        {children}
      </body>
    </html>
  );
}
