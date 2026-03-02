'use client';

import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type MouseEvent,
} from 'react';
import styles from './FormationComponent.module.css';

const GRID_COLUMNS = 10;
const GRID_ROWS = 5;

type EnemyOption = {
  enemyId: string;
  displayName?: string;
};

type EnemyCellSize = {
  width: 1 | 2;
  height: 1 | 2;
};

export type FormationPlacement = {
  id: string;
  enemyId: string;
  col: number;
  row: number;
  width: number;
  height: number;
};

export type FormationGrid = {
  columns: number;
  rows: number;
  placements: FormationPlacement[];
};

type FormationComponentProps = {
  enemies: EnemyOption[];
  enemyIcons?: Record<string, string | undefined>;
  enemyCellSizes?: Record<string, EnemyCellSize>;
  formation: FormationGrid;
  onChange: (formation: FormationGrid) => void;
};

type DragPayload =
  | { kind: 'catalog'; enemyId: string }
  | { kind: 'placement'; placementId: string };

const shortLabel = (enemyName: string): string =>
  enemyName.slice(0, 1).toUpperCase();

const normalizeCellSize = (size: EnemyCellSize | undefined): EnemyCellSize => {
  if (!size) return { width: 1, height: 1 };
  const width: 1 | 2 = size.width === 2 ? 2 : 1;
  const height: 1 | 2 = size.height === 2 ? 2 : 1;
  return { width, height };
};

const normalizeFormation = (formation: FormationGrid): FormationGrid => ({
  columns:
    Number.isFinite(formation.columns) && formation.columns > 0
      ? Math.floor(formation.columns)
      : GRID_COLUMNS,
  rows:
    Number.isFinite(formation.rows) && formation.rows > 0
      ? Math.floor(formation.rows)
      : GRID_ROWS,
  placements: Array.isArray(formation.placements) ? formation.placements : [],
});

const overlaps = (a: FormationPlacement, b: FormationPlacement): boolean =>
  a.col < b.col + b.width &&
  a.col + a.width > b.col &&
  a.row < b.row + b.height &&
  a.row + a.height > b.row;

const canPlace = (
  formation: FormationGrid,
  candidate: FormationPlacement,
  ignoreId?: string,
): boolean => {
  if (candidate.col < 0 || candidate.row < 0) return false;
  if (candidate.col + candidate.width > formation.columns) return false;
  if (candidate.row + candidate.height > formation.rows) return false;
  return !formation.placements.some(
    (existing) => existing.id !== ignoreId && overlaps(existing, candidate),
  );
};

const readDragPayload = (event: DragEvent): DragPayload | null => {
  const raw = event.dataTransfer.getData('application/x-playmasters-formation');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DragPayload;
    if (
      parsed?.kind === 'catalog' &&
      typeof parsed.enemyId === 'string' &&
      parsed.enemyId
    ) {
      return parsed;
    }
    if (
      parsed?.kind === 'placement' &&
      typeof parsed.placementId === 'string' &&
      parsed.placementId
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
};

const makePlacementId = (): string =>
  `placement-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function FormationComponent({
  enemies,
  enemyIcons,
  enemyCellSizes,
  formation,
  onChange,
}: FormationComponentProps) {
  const normalizedFormation = useMemo(
    () => normalizeFormation(formation),
    [formation],
  );
  const [selectedEnemyId, setSelectedEnemyId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<{
    col: number;
    row: number;
  } | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const nameByEnemyId = useMemo(
    () =>
      new Map(
        enemies.map((enemy) => [
          enemy.enemyId,
          enemy.displayName ?? enemy.enemyId,
        ]),
      ),
    [enemies],
  );

  const orderedEnemyOptions = useMemo(
    () =>
      [...enemies].sort((left, right) =>
        (left.displayName ?? left.enemyId).localeCompare(
          right.displayName ?? right.enemyId,
        ),
      ),
    [enemies],
  );

  const findPlacementAtCell = (col: number, row: number) =>
    normalizedFormation.placements.find(
      (placement) =>
        col >= placement.col &&
        col < placement.col + placement.width &&
        row >= placement.row &&
        row < placement.row + placement.height,
    );

  const toCellFromPointer = (
    event: DragEvent | MouseEvent,
  ): { col: number; row: number } | null => {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return null;
    }
    const cellWidth = rect.width / normalizedFormation.columns;
    const cellHeight = rect.height / normalizedFormation.rows;
    if (cellWidth <= 0 || cellHeight <= 0) return null;
    const col = Math.floor((event.clientX - rect.left) / cellWidth);
    const row = Math.floor((event.clientY - rect.top) / cellHeight);
    if (
      col < 0 ||
      col >= normalizedFormation.columns ||
      row < 0 ||
      row >= normalizedFormation.rows
    ) {
      return null;
    }
    return { col, row };
  };

  const placeEnemyAt = (
    enemyId: string,
    col: number,
    row: number,
    existingPlacementId?: string,
  ) => {
    const size = normalizeCellSize(enemyCellSizes?.[enemyId]);
    const candidate: FormationPlacement = {
      id: existingPlacementId ?? makePlacementId(),
      enemyId,
      col,
      row,
      width: size.width,
      height: size.height,
    };
    if (!canPlace(normalizedFormation, candidate, existingPlacementId)) return;

    const nextPlacements = existingPlacementId
      ? normalizedFormation.placements.map((placement) =>
          placement.id === existingPlacementId ? candidate : placement,
        )
      : [...normalizedFormation.placements, candidate];

    onChange({
      ...normalizedFormation,
      placements: nextPlacements.sort((left, right) =>
        left.row === right.row ? left.col - right.col : left.row - right.row,
      ),
    });
  };

  const onGridDrop = (event: DragEvent) => {
    event.preventDefault();
    const payload = readDragPayload(event);
    const cell = toCellFromPointer(event);
    setHoverCell(null);
    if (!payload || !cell) return;

    if (payload.kind === 'catalog') {
      placeEnemyAt(payload.enemyId, cell.col, cell.row);
      return;
    }

    const existing = normalizedFormation.placements.find(
      (placement) => placement.id === payload.placementId,
    );
    if (!existing) return;
    placeEnemyAt(existing.enemyId, cell.col, cell.row, existing.id);
  };

  const onGridClick = (event: MouseEvent) => {
    const cell = toCellFromPointer(event);
    if (!cell) return;
    if (selectedEnemyId) {
      placeEnemyAt(selectedEnemyId, cell.col, cell.row);
      return;
    }
    const existing = findPlacementAtCell(cell.col, cell.row);
    if (!existing) return;
    onChange({
      ...normalizedFormation,
      placements: normalizedFormation.placements.filter(
        (placement) => placement.id !== existing.id,
      ),
    });
  };

  return (
    <div className={styles.root}>
      <header className={styles.formationHeader}>
        <h3>Formation Grid (10 x 5)</h3>
        <div className={styles.hint}>
          Drag ships from catalog to grid. Click occupied cell to remove.
        </div>
      </header>

      <section className={styles.catalogPanel}>
        <h4 className={styles.panelTitle}>Enemy Ships</h4>
        <div className={styles.catalogGrid}>
          {orderedEnemyOptions.map((enemy) => {
            const size = normalizeCellSize(enemyCellSizes?.[enemy.enemyId]);
            return (
              <button
                key={enemy.enemyId}
                type="button"
                className={`${styles.catalogButton} ${
                  selectedEnemyId === enemy.enemyId
                    ? styles.catalogButtonActive
                    : ''
                }`}
                title={enemy.displayName ?? enemy.enemyId}
                draggable
                onClick={() =>
                  setSelectedEnemyId((current) =>
                    current === enemy.enemyId ? null : enemy.enemyId,
                  )
                }
                onDragStart={(event) => {
                  event.dataTransfer.setData(
                    'application/x-playmasters-formation',
                    JSON.stringify({ kind: 'catalog', enemyId: enemy.enemyId }),
                  );
                }}
              >
                {enemyIcons?.[enemy.enemyId] ? (
                  <img
                    src={enemyIcons[enemy.enemyId]}
                    alt={enemy.displayName ?? enemy.enemyId}
                    className={styles.catalogIcon}
                  />
                ) : (
                  <span className={styles.catalogFallback}>
                    {shortLabel(enemy.displayName ?? enemy.enemyId)}
                  </span>
                )}
                <span className={styles.catalogName}>
                  {enemy.displayName ?? enemy.enemyId}
                </span>
                <span className={styles.catalogSize}>
                  {size.width}x{size.height}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.gridPanel}>
        <div className={styles.gridActions}>
          <button
            type="button"
            className={styles.clearButton}
            onClick={() =>
              onChange({
                ...normalizedFormation,
                placements: [],
              })
            }
          >
            Clear Grid
          </button>
          <span className={styles.placementCount}>
            Ships: {normalizedFormation.placements.length}
          </span>
        </div>
        <div
          ref={gridRef}
          className={styles.gridCanvas}
          onDragOver={(event) => {
            event.preventDefault();
            setHoverCell(toCellFromPointer(event));
          }}
          onDragLeave={() => setHoverCell(null)}
          onDrop={onGridDrop}
          onClick={onGridClick}
        >
          {Array.from({
            length: normalizedFormation.columns * normalizedFormation.rows,
          }).map((_, index) => {
            const col = index % normalizedFormation.columns;
            const row = Math.floor(index / normalizedFormation.columns);
            const isHovered = hoverCell?.col === col && hoverCell?.row === row;
            return (
              <div
                key={`cell-${col}-${row}`}
                className={`${styles.gridCell} ${isHovered ? styles.gridCellHovered : ''}`}
                style={{
                  gridColumn: col + 1,
                  gridRow: row + 1,
                }}
              />
            );
          })}
          {normalizedFormation.placements.map((placement) => (
            <div
              key={placement.id}
              className={styles.placement}
              style={{
                gridColumn: `${placement.col + 1} / span ${placement.width}`,
                gridRow: `${placement.row + 1} / span ${placement.height}`,
              }}
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(
                  'application/x-playmasters-formation',
                  JSON.stringify({
                    kind: 'placement',
                    placementId: placement.id,
                  }),
                );
              }}
              title={nameByEnemyId.get(placement.enemyId) ?? placement.enemyId}
            >
              {enemyIcons?.[placement.enemyId] ? (
                <img
                  src={enemyIcons[placement.enemyId]}
                  alt={
                    nameByEnemyId.get(placement.enemyId) ?? placement.enemyId
                  }
                  className={styles.placementIcon}
                />
              ) : (
                <span className={styles.placementFallback}>
                  {shortLabel(
                    nameByEnemyId.get(placement.enemyId) ?? placement.enemyId,
                  )}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
