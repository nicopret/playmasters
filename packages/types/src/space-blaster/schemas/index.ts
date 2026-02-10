import gameConigSchema from './game-config.schema.json';
import scoreConfigSchema from './score-config.schema.json';

export const SpaceBlasterSchema = {
    gameConfig: gameConigSchema,
    scoreConfig: scoreConfigSchema
} as const;
