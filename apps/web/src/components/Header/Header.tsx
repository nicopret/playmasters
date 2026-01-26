import Image from 'next/image';
import Link from 'next/link';
import { Container, Button } from '@playmasters/ui';
import styles from './Header.module.css';

const Header = () => {
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
          <Button as="a" href="#" variant="secondary" size="sm">
            Sign in
          </Button>
        </div>
      </Container>
    </header>
  );
};

export default Header;
