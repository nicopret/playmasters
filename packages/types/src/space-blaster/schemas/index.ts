import gameConfigSchema from './game-config.schema.json';
import levelConfigSchema from './level-config.schema.json';
import scoreConfigSchema from './score-config.schema.json';

export const SpaceBlasterSchema = {
    gameConfig: gameConfigSchema,
    levelConfig: levelConfigSchema, 
    scoreConfig: scoreConfigSchema
} as const;
