# Tic Tac Toe Model 1

## The purpose of this document is to provide an ubiquitous language and domain model for Tic Tac Toe

### Model
- The board positions are:
  
  [
    
    row 1 :[column 1, column 2, column 3],

    row 2 :[column 1, column 2, column 3],
    
    row 3 :[column 1, column 2, column 3],

  ]
- The encoding of coordinates is "row-column", e.g: "1-3" is read "row 1 - column 3".
- Diagonal 1 is : [1-1,2-2, 3-3].
- Diagonal 2 is : [3-1,2-2, 3-1].
- Winning Line: a Winning Line, is a line that crosses the 3 positions where the user made its plays.

### Tests

1. The first move is from X player.
1. Every play changes changes between X and O player.
1. Clicking a played position does noting.
1. When the game start there's no restart button visible.
1. When the game is over the restart button is enabled.
1. When the restart button is pressed the board is cleaned and the first move is from player X.
1. When the are no more positions to play the game is over.
1. If any player can do 3 plays in the fist column he wins by "column 1" and the corresponding winning line is shown.
1. If any player can do 3 plays in the second column he wins by "column 2" and the corresponding winning line is shown.
1. If any player can do 3 plays in the third column he wins by "column 3" and the corresponding winning line is shown.
1. If any player can do 3 plays in the fist row he wins by "row 1" and the corresponding winning line is shown.
1. If any player can do 3 plays in the second row he wins by "row 2" and the corresponding winning line is shown.
1. If any player can do 3 plays in the third row he wins by "row 3" and the corresponding winning line is shown.
1. If any player can do 3 plays in the fist diagonal he wins by "diagonal 1" and the corresponding winning line is shown.
1. If any player can do 3 plays in the second diagonal he wins by "diagonal 2" and the corresponding winning line is shown.
1. If neither player has won but there are no more positions to play, the result of the game is a Draw.
1. The result must be shows at game over and hidden if the game is in process.
