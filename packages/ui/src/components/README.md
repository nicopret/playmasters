# @playmasters/ui components

Imports assume `@playmasters/brand/tokens.css` and `fonts.css` are loaded globally.

```tsx
import { Button, Card, Container, Badge, Input, Carousel, GameTile } from '@playmasters/ui';
```

- **Button**
  ```tsx
  <Button variant="primary" size="md" leftIcon={<IconPlay />}>Play</Button>
  <Button as="a" href="/learn-more" variant="ghost">Learn more</Button>
  ```

- **Card**
  ```tsx
  <Card variant="glow" padding="lg">Arcade content</Card>
  ```

- **Container**
  ```tsx
  <Container size="xl">Centered layout</Container>
  ```

- **Badge**
  ```tsx
  <Badge variant="info">Multiplayer</Badge>
  ```

- **Input**
  ```tsx
  <Input label="Username" placeholder="Player1" hint="Shown to other players" />
  ```

- **Carousel**
  ```tsx
  <Carousel items={[{ id: '1', title: 'Tournament', body: 'This weekend' }]} />
  ```

- **GameTile**
  ```tsx
  <GameTile
    title="Neon Drift"
    href="/games/neon-drift"
    imageUrl="/images/drift.jpg"
    tags={['Racing', 'Arcade']}
  />
  ```
