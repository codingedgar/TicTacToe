import React from 'react';
import './App.css';
import grid from './assets/grid.png';
import playerO from './assets/O.png';
import playerX from './assets/X.png';
import dia1 from './assets/diagonal1.png';
import dia2 from './assets/diagonal2.png';
import row1 from './assets/vertical1.png';
import row2 from './assets/vertical2.png';
import row3 from './assets/vertical3.png';
import col1 from './assets/horizontal1.png';
import col2 from './assets/horizontal2.png';
import col3 from './assets/horizontal3.png';
import { useMachine } from "@xstate/react";
import { Machine, assign } from "xstate";
import { Option, none, some, fold, isSome, chain } from "fp-ts/Option";
import { pipe } from "fp-ts/pipeable";

type Player = 'X' | 'O'

type Coordinate = 1 | 2 | 3

type Coordinates =
  { row: Coordinate; column: Coordinate }

type Action = { kind: 'Click' } | { kind: 'Played', player: Player }

type PlayedEvent =
  { type: 'PLAYED', payload: Coordinates }

type Event =
  | PlayedEvent
  | { type: 'RESTART' }

type Board = {
  row: Coordinate,
  column: Coordinate,
  action: Action,
}[]

type ResultType =
  | 'Draw'
  | 'Row1'
  | 'Row2'
  | 'Row3'
  | 'Col1'
  | 'Col2'
  | 'Col3'
  | 'Dia1'
  | 'Dia2'

type Result = { result: Extract<ResultType, 'Draw'> } | { result: Exclude<ResultType, 'Draw'>, player: Player }

type Accumulator = Record<ResultType, Option<{ player: Player, count: number }>>

type Context =
  {
    turn: Player
    accumulators: Accumulator
    board: Board
    result: Option<Result>
  }

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
  'Col1': col1,
  'Col2': col2,
  'Col3': col3,
  'Dia1': dia1,
  'Dia2': dia2,
}

function resultOfAccumulator(accumulator: Accumulator): Option<Result> {
  if (isSome(accumulator.Col1) && accumulator.Col1.value.count === 3) {
    return some({ result: 'Col1', player: accumulator.Col1.value.player } as const)
  } else if (isSome(accumulator.Col2) && accumulator.Col2.value.count === 3) {
    return some({ result: 'Col2', player: accumulator.Col2.value.player } as const)
  } else if (isSome(accumulator.Col3) && accumulator.Col3.value.count === 3) {
    return some({ result: 'Col3', player: accumulator.Col3.value.player } as const)
  } else if (isSome(accumulator.Row1) && accumulator.Row1.value.count === 3) {
    return some({ result: 'Row1', player: accumulator.Row1.value.player } as const)
  } else if (isSome(accumulator.Row2) && accumulator.Row2.value.count === 3) {
    return some({ result: 'Row2', player: accumulator.Row2.value.player } as const)
  } else if (isSome(accumulator.Row3) && accumulator.Row3.value.count === 3) {
    return some({ result: 'Row3', player: accumulator.Row3.value.player } as const)
  } else if (isSome(accumulator.Dia1) && accumulator.Dia1.value.count === 3) {
    return some({ result: 'Dia1', player: accumulator.Dia1.value.player } as const)
  } else if (isSome(accumulator.Dia2) && accumulator.Dia2.value.count === 3) {
    return some({ result: 'Dia2', player: accumulator.Dia2.value.player } as const)
  } else if (isSome(accumulator.Draw) && accumulator.Draw.value.count === 9) {
    return some({ result: 'Draw' } as const)
  } else {
    return none
  }
}

function resultTypeOfCoordinates(coordinates: Coordinates): ResultType[] {
  if (coordinates.column === 1 && coordinates.row === 1) {
    return ['Col1', 'Row1', 'Dia1', 'Draw']
  } else if (coordinates.column === 1 && coordinates.row === 2) {
    return ['Col1', 'Row2', 'Draw']
  } else if (coordinates.column === 1 && coordinates.row === 3) {
    return ['Col1', 'Row3', 'Dia2', 'Draw']
  } else if (coordinates.column === 2 && coordinates.row === 1) {
    return ['Col2', 'Row1', 'Draw']
  } else if (coordinates.column === 2 && coordinates.row === 2) {
    return ['Col2', 'Row2', 'Dia1', 'Dia2', 'Draw']
  } else if (coordinates.column === 2 && coordinates.row === 3) {
    return ['Col2', 'Row3', 'Draw']
  } else if (coordinates.column === 3 && coordinates.row === 1) {
    return ['Col3', 'Row1', 'Dia2', 'Draw']
  } else if (coordinates.column === 3 && coordinates.row === 2) {
    return ['Col3', 'Row2', 'Draw']
  } else if (coordinates.column === 3 && coordinates.row === 3) {
    return ['Col3', 'Row3', "Dia1", 'Draw']
  } else {
    return []
  }
}

const ACTIONS = {
  ASSIGN_TURN: assign<Context, PlayedEvent>({
    turn: (ctx) => ctx.turn === 'X'
      ? 'O'
      : 'X',
  }),
  ASSIGN_BOARD: assign<Context, PlayedEvent>({
    board: (ctx, e) => ctx.board.map(
      cell => (
        cell.column === e.payload.column
        &&
        cell.row === e.payload.row
      )
        ?
        ({
          ...cell,
          action: {
            kind: 'Played',
            player: ctx.turn
          }
        })
        : cell
    ),
  }),
  ASSIGN_ACC: assign<Context, PlayedEvent>(
    (ctx, e) => {


      const acc = pipe(
        resultTypeOfCoordinates(e.payload),
        oldAcc => oldAcc.reduce(
          (acc, curr) => ({
            ...acc,
            [curr]: pipe(
              acc[curr],
              fold(
                () => some({ player: ctx.turn, count: 1 }),
                prev =>
                  (
                    curr === 'Draw'
                    ||
                    prev.player === ctx.turn
                  )
                    ? some({ player: ctx.turn, count: prev.count + 1 })
                    : some(prev)
              )
            )
          }),
          ctx.accumulators
        )
      )

      return {
        result: resultOfAccumulator(acc),
        accumulators: acc
      }
    }
  ),
}

const DEFAULT_CONTEXT: Context = {
  result: none,
  turn: 'X',
  accumulators: {
    'Draw': none,
    'Row1': none,
    'Row2': none,
    'Row3': none,
    'Col1': none,
    'Col2': none,
    'Col3': none,
    'Dia1': none,
    'Dia2': none,
  },
  board: [
    {
      row: 1,
      column: 1,
      action: { kind: 'Click' },
    },
    {
      row: 2,
      column: 1,
      action: { kind: 'Click' },
    },
    {
      row: 3,
      column: 1,
      action: { kind: 'Click' },
    },
    {
      row: 1,
      column: 2,
      action: { kind: 'Click' },
    },
    {
      row: 2,
      column: 2,
      action: { kind: 'Click' },
    },
    {
      row: 3,
      column: 2,
      action: { kind: 'Click' },
    },
    {
      row: 1,
      column: 3,
      action: { kind: 'Click' },
    },
    {
      row: 2,
      column: 3,
      action: { kind: 'Click' },
    },
    {
      row: 3,
      column: 3,
      action: { kind: 'Click' },
    },
  ]
}

const machine = Machine<Context, Scheme, Event>({
  strict: true,
  initial: 'X',
  context: DEFAULT_CONTEXT,
  states: {
    X: {
      on: {
        '': {
          cond: (ctx) => isSome(ctx.result),
          target: 'DONE',
        },
        PLAYED: {
          target: 'O',
          actions: [
            ACTIONS.ASSIGN_ACC,
            ACTIONS.ASSIGN_BOARD,
            ACTIONS.ASSIGN_TURN,
          ],
        },
      },
    },
    O: {
      on: {
        '': {
          cond: (ctx) => isSome(ctx.result),
          target: 'DONE',
        },
        PLAYED: {
          target: 'O',
          actions: [
            ACTIONS.ASSIGN_ACC,
            ACTIONS.ASSIGN_BOARD,
            ACTIONS.ASSIGN_TURN,
          ],
        },
      },
    },
    DONE: {
      on: {
        RESTART: {
          target: 'X',
          actions: [
            assign(
              () => DEFAULT_CONTEXT
            )
          ]
        }
      }
    },
  },
})

function App() {

  const [state, send] = useMachine(machine)
  console.log(state)

  return (
    < div
      style={{
        display: 'grid',
        width: 108,
        height: 144,
        gridTemplateColumns: '36px 36px 36px',
        gridTemplateRows: '36px 36px 36px 36px 36px',
        margin: 'auto auto',
      }
      }
    >
      <p
        children={
          pipe(
            state.context.result,
            fold(
              () => `${state.context.turn} Turn`,
              r => (r.result === 'Draw')
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
        onClick={() => {
          console.log('background')
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
                  (cell.action.kind === 'Played')
                    ? `url(${(cell.action.player === 'X') ? playerX : playerO})`
                    : 'none',
                backgroundSize: '80%',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'center',
              }}
              onClick={() => {
                if (cell.action.kind === 'Click') {
                  send({ type: 'PLAYED', payload: { row: cell.row, column: cell.column } })
                }
              }}
            />
          )
        )
      }
      {
        pipe(
          state.context.result,
          chain(
            x => x.result === 'Draw'
              ? none
              : some(x)
          ),
          fold(
            () => null,
            res => (
              <img
                src={RESULT_TO_FIGURE[res.result]}
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
                    send({ type: 'RESTART' })
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
