import React from 'react';
import './App.css';
import grid from './assets/grid.png';
import playerO from './assets/O.png';
import playerX from './assets/X.png';
import diagonal1 from './assets/diagonal1.png';
import diagonal2 from './assets/diagonal2.png';
import row1 from './assets/vertical1.png';
import row2 from './assets/vertical2.png';
import row3 from './assets/vertical3.png';
import column1 from './assets/horizontal1.png';
import column2 from './assets/horizontal2.png';
import column3 from './assets/horizontal3.png';
import { useMachine } from "@xstate/react";
import { Machine, assign } from "xstate";
import { Option, none, some, fold, isSome, chain } from "fp-ts/Option";
import { pipe } from "fp-ts/pipeable";

type Player = 'X' | 'O'

type Coordinate = 1 | 2 | 3

type Coordinates = { row: Coordinate; column: Coordinate }

type CellState = { kind: 'Playable' } | { kind: 'Played', player: Player }

type Cell = Coordinates & { state: CellState }

type Board = [Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell, Cell]

type ResultType =
  | 'Draw'
  | 'Row1'
  | 'Row2'
  | 'Row3'
  | 'Column1'
  | 'Column2'
  | 'Column3'
  | 'Diagonal1'
  | 'Diagonal2'

type Result = { type: Extract<ResultType, 'Draw'> } | { type: Exclude<ResultType, 'Draw'>, player: Player }

type Event =
  | PlayedEvent
  | RestartedEvent

type RestartedEvent = { type: 'RESTARTED' }
type PlayedEvent = { type: 'PLAYED', payload: Coordinates }

type Context =
  {
    matchScore: MatchScore
    board: Board
    result: Option<Result>
  }

type MatchScore = Record<ResultType, Option<{ player: Player, count: number }>>

type Scheme = {
  states: {
    X: {}
    O: {}
    DONE: {}
  }
}

const RESULT_TO_FIGURE: Record<ResultType, string | undefined> = {
  'Draw': undefined,
  'Row1': row1,
  'Row2': row2,
  'Row3': row3,
  'Column1': column1,
  'Column2': column2,
  'Column3': column3,
  'Diagonal1': diagonal1,
  'Diagonal2': diagonal2,
}

const DEFAULT_CONTEXT: Context = {
  result: none,
  matchScore: {
    'Draw': none,
    'Row1': none,
    'Row2': none,
    'Row3': none,
    'Column1': none,
    'Column2': none,
    'Column3': none,
    'Diagonal1': none,
    'Diagonal2': none,
  },
  board: [
    {
      row: 1,
      column: 1,
      state: { kind: 'Playable' },
    },
    {
      row: 2,
      column: 1,
      state: { kind: 'Playable' },
    },
    {
      row: 3,
      column: 1,
      state: { kind: 'Playable' },
    },
    {
      row: 1,
      column: 2,
      state: { kind: 'Playable' },
    },
    {
      row: 2,
      column: 2,
      state: { kind: 'Playable' },
    },
    {
      row: 3,
      column: 2,
      state: { kind: 'Playable' },
    },
    {
      row: 1,
      column: 3,
      state: { kind: 'Playable' },
    },
    {
      row: 2,
      column: 3,
      state: { kind: 'Playable' },
    },
    {
      row: 3,
      column: 3,
      state: { kind: 'Playable' },
    },
  ]
}

function resultOfMatchScore(matchScore: MatchScore): Option<Result> {
  if (isSome(matchScore.Column1) && matchScore.Column1.value.count === 3) {
    return some({ type: 'Column1', player: matchScore.Column1.value.player } as const)
  } else if (isSome(matchScore.Column2) && matchScore.Column2.value.count === 3) {
    return some({ type: 'Column2', player: matchScore.Column2.value.player } as const)
  } else if (isSome(matchScore.Column3) && matchScore.Column3.value.count === 3) {
    return some({ type: 'Column3', player: matchScore.Column3.value.player } as const)
  } else if (isSome(matchScore.Row1) && matchScore.Row1.value.count === 3) {
    return some({ type: 'Row1', player: matchScore.Row1.value.player } as const)
  } else if (isSome(matchScore.Row2) && matchScore.Row2.value.count === 3) {
    return some({ type: 'Row2', player: matchScore.Row2.value.player } as const)
  } else if (isSome(matchScore.Row3) && matchScore.Row3.value.count === 3) {
    return some({ type: 'Row3', player: matchScore.Row3.value.player } as const)
  } else if (isSome(matchScore.Diagonal1) && matchScore.Diagonal1.value.count === 3) {
    return some({ type: 'Diagonal1', player: matchScore.Diagonal1.value.player } as const)
  } else if (isSome(matchScore.Diagonal2) && matchScore.Diagonal2.value.count === 3) {
    return some({ type: 'Diagonal2', player: matchScore.Diagonal2.value.player } as const)
  } else if (isSome(matchScore.Draw) && matchScore.Draw.value.count === 9) {
    return some({ type: 'Draw' } as const)
  } else {
    return none
  }
}

function resultTypeOfCoordinates(coordinates: Coordinates): ResultType[] {
  if (coordinates.column === 1 && coordinates.row === 1) {
    return ['Column1', 'Row1', 'Diagonal1', 'Draw']
  } else if (coordinates.column === 1 && coordinates.row === 2) {
    return ['Column1', 'Row2', 'Draw']
  } else if (coordinates.column === 1 && coordinates.row === 3) {
    return ['Column1', 'Row3', 'Diagonal2', 'Draw']
  } else if (coordinates.column === 2 && coordinates.row === 1) {
    return ['Column2', 'Row1', 'Draw']
  } else if (coordinates.column === 2 && coordinates.row === 2) {
    return ['Column2', 'Row2', 'Diagonal1', 'Diagonal2', 'Draw']
  } else if (coordinates.column === 2 && coordinates.row === 3) {
    return ['Column2', 'Row3', 'Draw']
  } else if (coordinates.column === 3 && coordinates.row === 1) {
    return ['Column3', 'Row1', 'Diagonal2', 'Draw']
  } else if (coordinates.column === 3 && coordinates.row === 2) {
    return ['Column3', 'Row2', 'Draw']
  } else if (coordinates.column === 3 && coordinates.row === 3) {
    return ['Column3', 'Row3', "Diagonal1", 'Draw']
  } else {
    return []
  }
}

const CONDITIONS = {
  IS_DONE: (ctx: Context) => isSome(ctx.result),
  IS_VALID_PLAY: (ctx: Context, e: PlayedEvent) => !!ctx.board.find(
    cell =>
      cell.column === e.payload.column
      &&
      cell.row === e.payload.row
      &&
      cell.state.kind === 'Playable'
  )
}

const ACTIONS = {
  ASSIGN_BOARD: (player: Player) => assign<Context, PlayedEvent>({
    board: (ctx, e) => ctx.board.map(
      cell => (
        cell.column === e.payload.column
        &&
        cell.row === e.payload.row
      )
        ?
        ({
          ...cell,
          state: {
            kind: 'Played',
            player: player,
          }
        })
        : cell
    ) as Board,
  }),
  ASSIGN_MATCH_SCORE: (player: Player) => assign<Context, PlayedEvent>(
    (ctx, e) => {
      const acc = pipe(
        resultTypeOfCoordinates(e.payload),
        oldAcc => oldAcc.reduce(
          (acc, curr) => ({
            ...acc,
            [curr]: pipe(
              acc[curr],
              fold(
                () => some({ player: player, count: 1 }),
                prev =>
                  (
                    curr === 'Draw'
                    ||
                    prev.player === player
                  )
                    ? some({ player: player, count: prev.count + 1 })
                    : some(prev)
              )
            )
          }),
          ctx.matchScore
        )
      )

      return {
        result: resultOfMatchScore(acc),
        matchScore: acc
      }
    }
  ),
  ASSIGN_DEFAULT_CONTEXT: assign<Context, RestartedEvent>(() => DEFAULT_CONTEXT),
}

const machine = Machine<Context, Scheme, Event>({
  strict: true,
  initial: 'X',
  context: DEFAULT_CONTEXT,
  states: {
    X: {
      always: {
        cond: CONDITIONS.IS_DONE,
        target: 'DONE',
      },
      on: {
        PLAYED: {
          cond: CONDITIONS.IS_VALID_PLAY,
          target: 'O',
          actions: [
            ACTIONS.ASSIGN_MATCH_SCORE('X'),
            ACTIONS.ASSIGN_BOARD('X'),
          ],
        },
      },
    },
    O: {
      always: {
        cond: CONDITIONS.IS_DONE,
        target: 'DONE',
      },
      on: {
        PLAYED: {
          cond: CONDITIONS.IS_VALID_PLAY,
          target: 'X',
          actions: [
            ACTIONS.ASSIGN_MATCH_SCORE('O'),
            ACTIONS.ASSIGN_BOARD('O'),
          ],
        },
      },
    },
    DONE: {
      on: {
        RESTARTED: {
          target: 'X',
          actions: [
            ACTIONS.ASSIGN_DEFAULT_CONTEXT,
          ]
        }
      }
    },
  },
})

function App() {

  const [state, send] = useMachine(machine)

  return (
    < div
      style={{
        display: 'grid',
        gridTemplateColumns: '36px 36px 36px',
        gridTemplateRows: '36px 36px 36px 36px 36px',
        width: 108,
        height: 180,
        margin: 'auto auto',
      }
      }
    >
      <p
        children={
          pipe(
            state.context.result,
            fold(
              () => `${state.matches('X') ? 'X' : 'O'} Turn`,
              r => (r.type === 'Draw')
                ? 'Draw'
                : `${r.player} Won`
            )
          )
        }
        style={{
          gridArea: '1/1/1/-1',
          justifySelf: 'center',
          alignSelf: 'center',
          margin: 0,
          fontWeight: 700,
        }}
      />
      <img
        src={grid}
        height={108}
        width={108}
        alt="grid"
        draggable={false}
        style={{
          gridColumn: '1/3',
          gridRow: '2/4',
          zIndex: 0,
        }}
      />
      {
        state.context.board.map(
          (cell) => (
            <div
              key={cell.row.toString().concat(cell.column.toString())}
              style={{
                gridColumnStart: cell.row,
                gridColumnEnd: cell.row,
                gridRowStart: cell.column + 1,
                gridRowEnd: cell.column + 1,
                zIndex: 2,
                backgroundImage:
                  (cell.state.kind === 'Played')
                    ? `url(${(cell.state.player === 'X') ? playerX : playerO})`
                    : 'none',
                backgroundSize: '80%',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
              onClick={() => {
                send({ type: 'PLAYED', payload: { row: cell.row, column: cell.column } })
              }}
            />
          )
        )
      }
      {
        pipe(
          state.context.result,
          chain(
            x => x.type === 'Draw'
              ? none
              : some(x)
          ),
          fold(
            () => null,
            res => (
              <img
                src={RESULT_TO_FIGURE[res.type]}
                height={108}
                width={108}
                alt="grid"
                draggable={false}
                style={{
                  gridArea: '2/1/4/3',
                  zIndex: 0,
                }}
              />
            )
          )
        )
      }
      {
        pipe(
          state.context.result,
          fold(
            () => null,
            () =>
              (
                <button
                  className="btn-restart-game"
                  style={{
                    gridArea: '5/1/6/4',
                  }}
                  children="Restart Game"
                  onClick={() => {
                    send({ type: 'RESTARTED' })
                  }}
                />
              )
          )
        )
      }
    </div >
  );
}

export default App;
