import gameConfigSchema from './game-config.schema.json';
import homeCatalogSchema from './home-catalog.schema.json';
import levelConfigSchema from './level-config.schema.json';
import scoreConfigSchema from './score-config.schema.json';
import heroCatalogSchema from './hero-catalog.schema.json';
import enemyCatalogSchema from './enemy-catalog.schema.json';
import ammoCatalogSchema from './ammo-catalog.schema.json';

export const SpaceBlasterSchema = {
    gameConfig: gameConfigSchema,
    homeCatalog: homeCatalogSchema,
    levelConfig: levelConfigSchema, 
    scoreConfig: scoreConfigSchema,
    heroCatalog: heroCatalogSchema,
    enemyCatalog: enemyCatalogSchema,
    ammoCatalog: ammoCatalogSchema
} as const;
