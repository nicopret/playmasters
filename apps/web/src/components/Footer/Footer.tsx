import Link from 'next/link';
import { Container } from '@playmasters/ui';
import styles from './Footer.module.css';

const Footer = () => {
  const year = new Date().getFullYear();
  return (
    <footer className={styles.footer}>
      <Container className={styles.inner}>
        <div className={styles.block}>
          <div className={styles.heading}>Follow</div>
          <div className={styles.links}>
            <Link href="#" className={styles.link}>
              Twitch
            </Link>
            <Link href="#" className={styles.link}>
              YouTube
            </Link>
            <Link href="#" className={styles.link}>
              X / Twitter
            </Link>
            <Link href="#" className={styles.link}>
              Discord
            </Link>
          </div>
        </div>

        <div className={styles.block}>
          <div className={styles.heading}>Legal</div>
          <div className={styles.links}>
            <Link href="#" className={styles.link}>
              Terms
            </Link>
            <Link href="#" className={styles.link}>
              Privacy
            </Link>
            <Link href="#" className={styles.link}>
              Contact
            </Link>
          </div>
        </div>

        <div className={styles.copyright}>© {year} Playmasters</div>
      </Container>
    </footer>
  );
};

export default Footer;
