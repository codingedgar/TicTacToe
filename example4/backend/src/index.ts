import { createServer } from "http";
import { Server, Socket } from "socket.io";
import { v4 as uuid } from "uuid";
import { Machine, Interpreter, interpret, assign, GuardMeta, StateMachine } from "xstate";
import * as O from "fp-ts/Option";
import { pipe } from "fp-ts/lib/pipeable";

type Player = 'X' | 'O'

type Position = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8

type Board = Map<Position, Player>

type Result =
  | 'Draw'
  | 'Row1'
  | 'Row2'
  | 'Row3'
  | 'Column1'
  | 'Column2'
  | 'Column3'
  | 'Diagonal1'
  | 'Diagonal2'

type Context = {
  X: string
  O: O.Option<string>
  client: {
    game: string
    turn: Player
    board: Board
    result: O.Option<Result>
  }
}

type Schema = {
  states: {
    WAITING: {}
    X: {}
    O: {}
    GAME_OVER: {}
  }
}

type GameStartedEvent = { type: 'GAME_STARTED', O: string }
type PlayedEvent = { type: 'PLAYED', player: string, position: Position }
type RestartedEvent = { type: 'RESTARTED' }

type Event =
  | GameStartedEvent
  | PlayedEvent
  | RestartedEvent

const winPatterns: Map<Exclude<Result, 'Draw'>, [Position, Position, Position]> = new Map([
  ['Row1', [0, 1, 2]],
  ['Row2', [3, 4, 5]],
  ['Row3', [6, 7, 8]],
  ['Column1', [0, 3, 6]],
  ['Column2', [1, 4, 7]],
  ['Column3', [2, 5, 8]],
  ['Diagonal1', [0, 4, 8]],
  ['Diagonal2', [6, 4, 2]],
])

function isValidPlay(ctx: Context, e: PlayedEvent, meta: GuardMeta<Context, PlayedEvent>) {
  return (
    !ctx.client.board.has(e.position)
    && (
      meta.state.matches('X') && e.player === ctx.X
      ||
      meta.state.matches('O') && pipe(ctx.O, O.fold(() => false, O => O === e.player))
    )
  )
}

function matchResult(ctx: Context, e: PlayedEvent, player: Player): O.Option<Result> {

  for (let [result, positions] of winPatterns.entries()) {
    if (
      positions.includes(e.position)
      &&
      positions.every(position =>
        position === e.position
        ||
        pipe(
          ctx.client.board.get(position),
          x => x === player
        )
      )
    ) {
      return O.some(result)
    }
  }

  if (ctx.client.board.size === 9) {
    return O.some('Draw')
  } else {
    return O.none;
  }

}

const COND = {
  IS_GAME_OVER: (ctx: Context, e: PlayedEvent, meta: GuardMeta<Context, PlayedEvent>) => {
    return (isValidPlay(ctx, e, meta) && O.isSome(matchResult(ctx, e, meta.state.matches('X') ? 'X' : 'O')))
  },
  IS_VALID_PLAY: (ctx: Context, e: PlayedEvent, meta: GuardMeta<Context, PlayedEvent>) =>
    isValidPlay(ctx, e, meta)
}

const ACTION = {
  PLAY_POSITION: assign<Context, PlayedEvent>({
    client: (ctx, e, meta) => ({
      ...ctx.client,
      board: ctx.client.board.set(e.position, meta.state!.matches('X') ? 'X' : 'O'),
    })
  }),
  CHANGE_TURN: assign<Context, PlayedEvent>({
    client: (ctx, e, meta) => ({
      ...ctx.client,
      turn: meta.state!.matches('X') ? 'O' : 'X',
    })
  }),
  ASSIGN_O: assign<Context, GameStartedEvent>({
    O: (_ctx, e) => O.some(e.O)
  }),
  ASSIGN_WINNER: assign<Context, PlayedEvent>({
    client: (ctx, e, meta) => ({
      ...ctx.client,
      result: matchResult(ctx, e, meta.state!.matches('X') ? 'X' : 'O'),
    })
  }),
  RESTARTED: assign<Context, RestartedEvent>(
    (ctx) => initialState(ctx.client.game, ctx.X, ctx.O),
  ),
}

function initialState(game: string, x: string, o: O.Option<string>): Context {
  return {
    O: o,
    X: x,
    client: {
      game: game,
      turn: 'X',
      board: new Map(),
      result: O.none,
    }
  }
}

function createNewGameMachine(game: string, x: string): StateMachine<Context, Schema, Event> {

  return Machine<Context, Schema, Event>({
    strict: true,
    context: initialState(game, x, O.none),
    initial: 'WAITING',
    states: {
      WAITING: {
        on: {
          GAME_STARTED: {
            target: 'X',
            actions: [
              ACTION.ASSIGN_O,
            ]
          }
        }
      },
      X: {
        on: {
          PLAYED: [
            {
              cond: COND.IS_GAME_OVER,
              target: 'GAME_OVER',
              actions: [
                ACTION.PLAY_POSITION,
                ACTION.ASSIGN_WINNER,
              ],
            },
            {
              cond: COND.IS_VALID_PLAY,
              target: 'O',
              actions: [
                ACTION.PLAY_POSITION,
                ACTION.CHANGE_TURN,
              ]
            },
          ],
        },
      },
      O: {
        on: {
          PLAYED: [
            {
              cond: COND.IS_GAME_OVER,
              target: 'GAME_OVER',
              actions: [
                ACTION.PLAY_POSITION,
                ACTION.ASSIGN_WINNER,
              ],
            },
            {
              cond: COND.IS_VALID_PLAY,
              target: 'X',
              actions: [
                ACTION.PLAY_POSITION,
                ACTION.CHANGE_TURN,
              ]
            }
          ],
        },
      },
      GAME_OVER: {
        on: {
          RESTARTED: {
            target: 'X',
            actions: [
              ACTION.RESTARTED,
            ]
          }
        }
      },
    }
  })
}

let states: Map<string, Interpreter<Context, Schema, Event>> = new Map();

const httpServer = createServer();

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"],
  },
});

io.on('connection', (socket: Socket) => {

  socket.on('CREATE_GAME', async () => {

    const game = uuid();

    await socket.join(game);

    const machine = interpret(createNewGameMachine(game, socket.id));

    machine
      .onTransition(state => {

        io.to(game).emit('STATE_CHANGE', {
          ...state.context.client,
          board: Array.from(state.context.client.board.entries())
        })

      })
      .start();

    states.set(game, machine);

  });

  socket.on('JOIN_GAME', async (game: string) => {

    const machine = states.get(game);

    if (machine) {

      await socket.join(game);
      machine.send({ type: 'GAME_STARTED', O: socket.id });
      io.to(game).emit('GAME_STARTED');

    } else {
      socket.disconnect();
    }

  })

  socket.on('PLAY', (position: Position) => {

    socket.rooms.forEach(
      room => {

        const machine = states.get(room);

        if (machine) {

          machine.send({
            type: 'PLAYED',
            player: socket.id,
            position,
          });

        }

      }
    );

  });

  socket.on('RESTARTED', () => {

    for (const room of socket.rooms) {
      if (room !== socket.id) {
        const machine = states.get(room);

        if (machine) {
          machine.send({ type: 'RESTARTED' })
        }
      }

    }

  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room !== socket.id) {
        socket.to(room).emit("USER_LEFT", socket.id);
        states.delete(room);
      }
    }
  });

});

httpServer.listen(5000, () => {
  console.log('server started')
});
