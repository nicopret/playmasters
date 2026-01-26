'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Container, Button, Card } from '@playmasters/ui';
import styles from './Header.module.css';

const Header = () => {
  const { data: session, status } = useSession();
  const user = session?.user;
  const isLoading = status === 'loading';

  return (
    <header className={styles.header}>
      <Container className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <div className={styles.logoWrap}>
            <Image
              src="/brand/playmaster_logo.png"
              alt="Playmasters logo"
              fill
              sizes="64px"
              className={styles.logo}
              priority
            />
          </div>
          <span className={styles.wordmark}>Playmasters</span>
        </Link>

        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>
            Home
          </Link>
          <Link href="/games" className={styles.navLink}>
            Games
          </Link>
        </nav>

        <div className={styles.actions}>
          {!user ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => signIn('google')}
              disabled={isLoading}
            >
              Sign in with Google
            </Button>
          ) : (
            <Card className={styles.userCard} padding="sm" variant="surface">
              <div className={styles.userMeta}>
                <div className={styles.avatar}>
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name ?? user.email ?? 'User avatar'}
                      fill
                      sizes="40px"
                    />
                  ) : (
                    <span className={styles.avatarFallback}>
                      {(user.name ?? user.email ?? 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className={styles.userText}>
                  <span className={styles.userName}>{user.name ?? user.email}</span>
                  <div className={styles.userLinks}>
                    <Link href="/profile" className={styles.navLink}>
                      Profile
                    </Link>
                    <button type="button" className={styles.signOut} onClick={() => signOut()}>
                      Sign out
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </Container>
    </header>
  );
};

export default Header;
