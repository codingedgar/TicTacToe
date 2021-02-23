import React, { useRef, useEffect, useState } from 'react';
import './App.css';
import { useMachine } from "@xstate/react";
import { Machine, assign } from "xstate";
import { Option, none, some, fold, isSome, chain, isNone } from "fp-ts/Option";
import { pipe } from "fp-ts/pipeable";
import { io, Socket } from "socket.io-client";

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


type Player = 'X' | 'O'

type Position = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

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
  socket: Option<Socket>
  me: Player
  server: {
    board: Board
    turn: Player
    game: string
    result: Option<Result>
  }
}

type Schema = {
  states: {
    WAITING: {}
    MY_TURN: {}
    NOT_MY_TURN: {}
    GAME_OVER: {}
  }
}

type GameStartedEvent = { type: 'GAME_STARTED', socket: Socket }
type PlayedEvent = { type: 'PLAYED', position: Position }
type RestartedEvent = { type: 'RESTARTED' }
type StateChangedEvent = { type: 'STATE_CHANGED', context: Context['server'] }
type CopyToClipboardEvent = { type: 'COPY_TO_CLIPBOARD' }

type Event =
  | PlayedEvent
  | RestartedEvent
  | StateChangedEvent
  | GameStartedEvent
  | CopyToClipboardEvent


const defaultContext = (me: Player): Context => ({
  socket: none,
  me,
  server: {
    turn: 'X',
    game: '',
    board: new Map(),
    result: none,
  }
})

const ACTION = {
  ASSIGN_STATE: assign<Context, StateChangedEvent>(
    (ctx, e) => ({
      ...ctx,
      server: e.context,
    })
  ),
  PLAY_POSITION: (ctx: Context, e: PlayedEvent) => {
    pipe(
      ctx.socket,
      fold(
        () => { },
        socket => {
          socket.emit('PLAY', e.position)
        }
      )
    )
  },
  ASSIGN_SOCKET: assign<Context, GameStartedEvent>({
    socket: (_ctx, e) => some(e.socket)
  }),
  RESTART: (ctx: Context, e: RestartedEvent) => {
    pipe(
      ctx.socket,
      fold(
        () => { },
        socket => {
          socket.emit('RESTARTED')
        }
      )
    )
  },
}

const machine = Machine<Context, Schema, Event>({
  strict: true,
  initial: 'WAITING',
  on: {
    PLAYED: {
      actions: [
        ACTION.PLAY_POSITION,
      ],
    },
    STATE_CHANGED: [
      {
        cond: (ctx) => isNone(ctx.socket),
        actions: [
          ACTION.ASSIGN_STATE,
        ]
      },
      {
        cond: (ctx, e) => isSome(e.context.result),
        target: 'GAME_OVER',
        actions: [
          ACTION.ASSIGN_STATE,
        ]
      },
      {
        cond: (ctx, e) => ctx.me === e.context.turn,
        target: 'MY_TURN',
        actions: [
          ACTION.ASSIGN_STATE,
        ]
      },
      {
        target: 'NOT_MY_TURN',
        actions: [
          ACTION.ASSIGN_STATE,
        ]
      },
    ],
  },
  states: {
    WAITING: {
      on: {
        GAME_STARTED: [
          {
            cond: (ctx) => ctx.me === 'X',
            actions: [
              ACTION.ASSIGN_SOCKET,
            ],
            target: 'MY_TURN'
          },
          {
            actions: [
              ACTION.ASSIGN_SOCKET,
            ],
            target: 'NOT_MY_TURN'
          }
        ],
        COPY_TO_CLIPBOARD: {
          actions: [
            (ctx, e, meta) => {
              navigator.clipboard.writeText(ctx.server.game)
                .then(() => {
                  window.alert("Copied to Clipboard");
                });
            }
          ]
        }
      }
    },
    MY_TURN: {},
    NOT_MY_TURN: {},
    GAME_OVER: {
      on: {
        RESTARTED: {
          actions: [
            ACTION.RESTART,
          ]
        },
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
  lineType: Result
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

type Props = ({
  startIn: 'new game'
} | {
  startIn: 'join'
  id: string
}) & {
  onDisconnected: () => void
}

function Game(props: Props) {

  const [state, send] = useMachine(machine
    .withContext(defaultContext(props.startIn === 'new game' ? 'X' : 'O')))


  useEffect(() => {
    const socket = io("ws://localhost:5000", {
      reconnection: false,
    });

    socket.on("connect", () => {
      if (props.startIn === 'new game') {
        socket.emit('CREATE_GAME');
      } else {
        socket.emit('JOIN_GAME', props.id);
      }
    });

    socket.on('GAME_STARTED', () => {
      send({ type: 'GAME_STARTED', socket: socket })
    });

    socket.on("STATE_CHANGE", (ctx: Context['server']) => {
      send({
        type: 'STATE_CHANGED', context: {
          ...ctx,
          board: new Map(ctx.board),
        }
      })
    });

    socket.on("USER_LEFT", () => {
      props.onDisconnected()
    });

    socket.on('connect_error', () => {
      props.onDisconnected()
    })

    socket.on('disconnect', () => {
      props.onDisconnected()
    })

    return () => {
      socket.disconnect()
    }
  }, [send, props])

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
        {
          state.matches('WAITING') && (
            <button
              className="btn-restart-game"
              style={{
                gridArea: '5/1/6/4',
              }}
              children={state.context.server.game}
              onClick={() => {
                send({ type: 'COPY_TO_CLIPBOARD' })
              }}
            />
          )
        }
        <p
          children={
            pipe(
              state.context.server.result,
              fold(
                () =>
                  state.matches('MY_TURN')
                    ? 'My turn'
                    : state.matches('NOT_MY_TURN')
                      ? 'Their turn'
                      : 'Waiting other player'
                ,
                r => (r === 'Draw')
                  ? 'Draw'
                  : `${state.context.server.turn} Won`
              ),
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
          ([
            0, 1, 2, 3, 4, 5, 6, 7, 8
          ] as Position[])
            .map(position =>
              pipe(
                (state.context.server.board.get(position)),
                player =>
                  (player === 'X')
                    ? (
                      <PlayerXCanvas
                        key={position}
                        style={{
                          gridColumnStart: (position % 3) + 1,
                          gridColumnEnd: (position % 3) + 1,
                          gridRowStart: Math.floor(position / 3) + 2,
                          gridRowEnd: Math.floor(position / 3) + 2,
                          zIndex: 1,
                        }}
                      />
                    )
                    :
                    (player === 'O')
                      ?
                      (
                        <PlayerOCanvas
                          key={position}
                          style={{
                            gridColumnStart: (position % 3) + 1,
                            gridColumnEnd: (position % 3) + 1,
                            gridRowStart: Math.floor(position / 3) + 2,
                            gridRowEnd: Math.floor(position / 3) + 2,
                            zIndex: 1,
                          }}
                        />
                      )
                      : (
                        <div
                          key={position}
                          style={{
                            gridColumnStart: (position % 3) + 1,
                            gridColumnEnd: (position % 3) + 1,
                            gridRowStart: Math.floor(position / 3) + 2,
                            gridRowEnd: Math.floor(position / 3) + 2,
                            zIndex: 1,
                          }}
                          onClick={() => {
                            send({ type: 'PLAYED', position })
                          }}
                        />
                      )
              )
            )
        }
        {
          pipe(
            state.context.server.result,
            chain(
              x => x === 'Draw'
                ? none
                : some(x)
            ),
            fold(
              () => null,
              res => (
                <WinningLineCanvas
                  lineType={res}
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
            state.context.server.result,
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

type AppState = { stage: 'waiting' | 'started' | 'joined', id: string }

function App() {

  const [state, setInGame] = useState<AppState>({ stage: 'waiting', id: '' });

  return (
    < div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'auto 128px 64px 64px auto',
        gridGap: '8px 8px',
        width: 250,
        height: '100vh',
        margin: 'auto auto',
      }}
    >
      {
        (state.stage === 'waiting') && (
          <>
            <button
              className="btn-restart-game"
              style={{
                gridArea: '2/1/2/1',
              }}
              children="Start a new game ✨"
              onClick={() => {
                setInGame({ stage: 'started', id: '' })
              }}
            />
            <input
              type="text"
              placeholder="paste game id here"
              style={{
                gridArea: '3/1/3/1'
              }}
              value={state.id}
              onChange={e => {
                setInGame({ stage: 'waiting', id: e.target.value })
              }}
            />
            <button
              className="btn-restart-game"
              style={{
                gridArea: '4/1/4/1',
              }}
              children="Join Game 🎯"
              onClick={() => {
                setInGame(prev => ({ ...prev, stage: 'joined' }))
              }}
            />
          </>
        )
      }
      {
        (state.stage === 'started') && (
          <Game
            startIn='new game'
            onDisconnected={() => {
              setInGame({ stage: 'waiting', id: '' })
            }}
          />
        )
      }
      {
        (state.stage === 'joined') && (
          <Game
            startIn='join'
            id={state.id}
            onDisconnected={() => {
              setInGame({ stage: 'waiting', id: '' })
            }}
          />
        )
      }
    </div>
  );
}

export default App;
