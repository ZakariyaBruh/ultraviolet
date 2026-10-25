import type { Game } from './engine'
import { breakout, catcher, dodge, pong, snake } from './g1'
import { asteroids, flap, invaders, runner, whack } from './g2'
import { aim, cross, orbit, stack, tunnel } from './g3'
import { gravity, lander, maze, slash, turret } from './g4'

export const GAMES: Game[] = [dodge, catcher, pong, breakout, snake, flap, runner, invaders, asteroids, whack, aim, stack, cross, tunnel, orbit, gravity, slash, turret, maze, lander]
/** what one round costs, in credits */
export const COST = 4
