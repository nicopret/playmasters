import '@playmasters/brand/tokens.css';
import '@playmasters/brand/fonts.css';
import './global.css';
import { AuthProvider } from '../components/AuthProvider/AuthProvider';

export const metadata = {
  title: 'Playmasters Admin',
  description: 'Admin console for Playmasters',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
