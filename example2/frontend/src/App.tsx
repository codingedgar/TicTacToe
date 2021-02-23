import React, { useRef, useEffect } from 'react';
import './App.css';
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

const BOARD_SIZE = 208 as const;
const BOARD_PADDING = 4 as const;
const LINE_WIDTH = 8 as const;
const LINE_CAP_SIZE = LINE_WIDTH / 2;
const CELL_SIZE = 64 as const;
const CELL_PADDING = 4 as const;
const CELL_CENTER = CELL_SIZE / 2;
const COLOR1 = '#FFD103';
const COLOR2 = '#A303FF';
const COLOR3 = '#CCCCCC';

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

function BoardCanvas(
  props: React.DetailedHTMLProps<
    React.CanvasHTMLAttributes<HTMLCanvasElement>,
    HTMLCanvasElement
  >
) {

  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(
    () => {

      const lineLength = BOARD_SIZE - BOARD_PADDING - LINE_CAP_SIZE;
      const fistSquare = CELL_SIZE + BOARD_PADDING;
      const secondSquare = (2 * CELL_SIZE) + BOARD_PADDING + LINE_CAP_SIZE;
      const lineDistanceFromBoardEdge = BOARD_PADDING + LINE_CAP_SIZE;

      const context = canvas.current!.getContext('2d')!;

      context.lineWidth = LINE_WIDTH;
      context.lineCap = 'round';
      context.strokeStyle = COLOR3;

      context.beginPath();

      // vertical
      context.moveTo(fistSquare, lineDistanceFromBoardEdge);
      context.lineTo(fistSquare, lineLength);

      context.moveTo(secondSquare, lineDistanceFromBoardEdge);
      context.lineTo(secondSquare, lineLength);

      // horizontal
      context.moveTo(lineDistanceFromBoardEdge, fistSquare);
      context.lineTo(lineLength, fistSquare);

      context.moveTo(lineDistanceFromBoardEdge, secondSquare);
      context.lineTo(lineLength, secondSquare);

      context.stroke();
    },
    [canvas]
  )

  return (
    <canvas
      {...props}
      height={BOARD_SIZE}
      width={BOARD_SIZE}
      style={{
        ...props.style,
        backgroundColor: '#fff',
        boxShadow: '5px 5px 5px 0px rgba(0,0,0,0.75)',
      }}
      ref={canvas}
    />
  )
}

function PlayerXCanvas(
  props: React.DetailedHTMLProps<
    React.CanvasHTMLAttributes<HTMLCanvasElement>,
    HTMLCanvasElement
  >
) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(
    () => {
      const lineStart = BOARD_PADDING + LINE_CAP_SIZE + CELL_PADDING + LINE_CAP_SIZE;
      const lineLength = CELL_SIZE - lineStart;

      const context = canvas.current!.getContext('2d')!;
      context.lineWidth = LINE_WIDTH;
      context.lineCap = 'round';
      context.strokeStyle = COLOR2;
      context.beginPath();

      context.moveTo(lineStart, lineStart);
      context.lineTo(lineLength, lineLength);

      context.moveTo(lineLength, lineStart);
      context.lineTo(lineStart, lineLength);

      context.stroke();
    },
    [canvas]
  )

  return (
    <canvas
      {...props}
      height={CELL_SIZE}
      width={CELL_SIZE}
      ref={canvas}
    />
  )
}

function PlayerOCanvas(
  props: React.DetailedHTMLProps<
    React.CanvasHTMLAttributes<HTMLCanvasElement>,
    HTMLCanvasElement
  >
) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(
    () => {
      const lineExternalWidth = LINE_WIDTH / 2;
      const radius = CELL_CENTER - BOARD_PADDING - LINE_CAP_SIZE - CELL_PADDING - lineExternalWidth;
      const startAngle = 0;
      const endAngle = 2 * Math.PI;

      const context = canvas.current!.getContext('2d')!;
      context.lineWidth = LINE_WIDTH;
      context.strokeStyle = COLOR2;

      context.beginPath();

      context.arc(CELL_CENTER, CELL_CENTER, radius, startAngle, endAngle);

      context.stroke();

    },
    [canvas]
  )

  return (
    <canvas
      {...props}
      height={CELL_SIZE}
      width={CELL_SIZE}
      ref={canvas}
    />
  )
}

function WinningLineCanvas(props: {
  canvasProps: React.DetailedHTMLProps<
    React.CanvasHTMLAttributes<HTMLCanvasElement>,
    HTMLCanvasElement
  >,
  lineType: ResultType
}) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(
    () => {
      const lineWidth = LINE_WIDTH * 2;
      const linePadding = LINE_CAP_SIZE * 2;
      const lineLength = BOARD_SIZE - (linePadding * 2);
      const middleOfSeparation = CELL_CENTER;
      const fistCellCenter = middleOfSeparation;
      const secondCellCenter = middleOfSeparation + CELL_SIZE + LINE_WIDTH;
      const thirdCellCenter = middleOfSeparation + (2 * (CELL_SIZE + LINE_WIDTH));
      const distanceFromBoardEdge = BOARD_PADDING + LINE_CAP_SIZE + linePadding;


      const context = canvas.current!.getContext('2d')!;
      context.lineWidth = lineWidth;
      context.lineCap = 'round';
      context.strokeStyle = COLOR1;

      context.beginPath();

      switch (props.lineType) {
        case 'Column1':
          context.moveTo(fistCellCenter, distanceFromBoardEdge);
          context.lineTo(fistCellCenter, lineLength);
          break;
        case 'Column2':
          context.moveTo(secondCellCenter, distanceFromBoardEdge);
          context.lineTo(secondCellCenter, lineLength);
          break;
        case 'Column3':
          context.moveTo(thirdCellCenter, distanceFromBoardEdge);
          context.lineTo(thirdCellCenter, lineLength);
          break;
        case 'Row1':
          context.moveTo(distanceFromBoardEdge, fistCellCenter);
          context.lineTo(lineLength, fistCellCenter);
          break;
        case 'Row2':
          context.moveTo(distanceFromBoardEdge, secondCellCenter);
          context.lineTo(lineLength, secondCellCenter);
          break;
        case 'Row3':
          context.moveTo(distanceFromBoardEdge, thirdCellCenter);
          context.lineTo(lineLength, thirdCellCenter);
          break;
        case 'Diagonal1':
          context.moveTo(distanceFromBoardEdge, distanceFromBoardEdge);
          context.lineTo(lineLength, lineLength);
          break;
        case 'Diagonal2':
          context.moveTo(lineLength, distanceFromBoardEdge);
          context.lineTo(distanceFromBoardEdge, lineLength);
          break;
        default:
          break;
      }

      context.stroke();
    },
    [canvas, props.lineType]
  )

  return (
    <canvas
      {...props.canvasProps}
      height={BOARD_SIZE}
      width={BOARD_SIZE}
      ref={canvas}
    />
  )
}

function App() {

  const [state, send] = useMachine(machine)

  return (
    <>
      < div
        style={{
          display: 'grid',
          gridTemplateColumns: '64px 64px 64px',
          gridTemplateRows: '64px 64px 64px 64px 64px',
          gridGap: '8px 8px',
          width: 208,
          height: 352,
          margin: 'auto auto',
        }}
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
        <BoardCanvas
          style={{
            gridColumn: '1/3',
            gridRow: '2/4',
            zIndex: 0,
          }}
        />
        {
          state.context.board.map(
            (cell) => (
              (cell.state.kind === 'Played')
                ? (cell.state.player === 'X')
                  ? <PlayerXCanvas
                    key={cell.row.toString().concat(cell.column.toString())}
                    style={{
                      gridColumnStart: cell.column,
                      gridColumnEnd: cell.column,
                      gridRowStart: cell.row + 1,
                      gridRowEnd: cell.row + 1,
                      zIndex: 1,
                    }}
                  />
                  : <PlayerOCanvas
                    key={cell.row.toString().concat(cell.column.toString())}
                    style={{
                      gridColumnStart: cell.column,
                      gridColumnEnd: cell.column,
                      gridRowStart: cell.row + 1,
                      gridRowEnd: cell.row + 1,
                      zIndex: 1,
                    }}
                  />
                : <div
                  key={cell.row.toString().concat(cell.column.toString())}
                  id={cell.row.toString().concat(cell.column.toString())}
                  style={{
                    gridColumnStart: cell.column,
                    gridColumnEnd: cell.column + 1,
                    gridRowStart: cell.row + 1,
                    gridRowEnd: cell.row + 1,
                    zIndex: 1,
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
                <WinningLineCanvas
                  lineType={res.type}
                  canvasProps={{
                    style: {
                      gridArea: '2/1/4/3',
                      zIndex: 0,
                    }
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
    </>
  );
}

export default App;
