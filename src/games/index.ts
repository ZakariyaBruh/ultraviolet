import type { Game } from './engine'
import { dodge } from './g1'
import { breakout, pong, snake } from './g5'
import { invaders } from './g6'
import { asteroids } from './g7'
import { tunnel } from './g3'
import { stack } from './g8'
import { cross, orbit } from './g9'
import { gravity, lander, maze, slash, turret } from './g4'
import { rogue } from './g10'

export const GAMES: Game[] = [dodge, pong, breakout, snake, invaders, asteroids, stack, cross, tunnel, orbit, gravity, slash, turret, maze, lander, rogue]
/** what one round costs, in credits */
export const COST = 4
