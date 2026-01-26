'use client';

import Image from 'next/image';
import { Button, Card, Container } from '@playmasters/ui';
import { useSession, signIn, signOut } from 'next-auth/react';
import styles from './page.module.css';

const ProfilePage = () => {
  const { data: session, status } = useSession();
  const user = session?.user;

  const isLoading = status === 'loading';

  if (!user) {
    return (
      <div className={styles.page}>
        <Container>
          <Card className={styles.signinPrompt} padding="lg" variant="surface">
            <h1>Profile</h1>
            <p>Please sign in to view your profile.</p>
            <Button onClick={() => signIn('google')} disabled={isLoading}>
              Sign in with Google
            </Button>
          </Card>
        </Container>
      </div>
    );
  }

  const displayName = user.name ?? user.email ?? 'Player';

  return (
    <div className={styles.page}>
      <Container>
        <Card className={styles.card} padding="lg" variant="surface">
          <div className={styles.header}>
            <div className={styles.avatar}>
              {user.image ? (
                <Image src={user.image} alt={displayName} fill sizes="64px" />
              ) : (
                displayName.charAt(0).toUpperCase()
              )}
            </div>
            <div className={styles.info}>
              <div className={styles.name}>{displayName}</div>
              {user.email ? <div className={styles.email}>{user.email}</div> : null}
              <Button variant="secondary" size="sm" onClick={() => signOut()}>
                Sign out
              </Button>
            </div>
          </div>

          <div className={styles.section}>
            <h2>Your personal bests</h2>
            <p>Your personal bests will appear here.</p>
          </div>
        </Card>
      </Container>
    </div>
  );
};

export default ProfilePage;
