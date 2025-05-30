import { Chess } from 'chess.js';

/**
 * Parse puzzle moves from the puzzle data
 * @param {Object} puzzle - The puzzle data
 * @param {string} defaultFen - Default starting position
 * @returns {Object} Object with FEN string, moves array, and Chess instance
 */
export function parsePuzzleMoves(puzzle, defaultFen) {
  try {
    // Use the puzzle's initial_fen property or fall back to defaultFen
    const fen = puzzle.initial_fen || defaultFen;
    const newChess = new Chess(fen);

    // Parse moves from the database format
    let moves = [];
    try {
      if (puzzle.moves) {
        // Try to parse as JSON first
        moves = JSON.parse(puzzle.moves);
      }
    } catch (error) {
      // Fallback to splitting by comma if JSON parsing fails
      moves = puzzle.moves ? puzzle.moves.split(' ') : [];
    }

    // Ensure moves is always an array
    if (!Array.isArray(moves)) {
      moves = [];
    }

    const starting_color = newChess.turn() === 'w' ? 'white' : 'black';

    return {
      fen,
      moves,
      newChess,
      starting_color
    };
  } catch (error) {
    console.error('Error parsing puzzle moves:', error);
    return {
      fen: defaultFen,
      moves: [],
      newChess: new Chess(defaultFen),
      starting_color: 'white'
    };
  }
}

/**
 * Create a chess position for replaying a puzzle solution
 * @param {Object} puzzle - The puzzle data
 * @param {Array} moves - The moves array
 * @param {number} moveIndex - The current move index to replay up to
 * @returns {Chess} Chess instance with moves applied
 */
export function createReplayPosition(puzzle, moves, moveIndex) {
  try {
    const chess = new Chess(puzzle.initial_fen);

    // Apply moves up to the specified index
    for (let i = 0; i < moveIndex && i < moves.length; i++) {
      const move = moves[i];
      const fromSquare = move.substring(0, 2);
      const toSquare = move.substring(2, 4);

      // Handle promotion if needed
      const promotion = move.length > 4 ? move.substring(4, 5) : undefined;

      // Make the move
      chess.move({
        from: fromSquare,
        to: toSquare,
        promotion: promotion || 'q'
      });
    }

    return chess;
  } catch (error) {
    console.error('Error creating replay position:', error);
    return null;
  }
}

/**
 * Extract a move from a UCI formatted move string
 * @param {string} moveString - UCI formatted move string (e.g., "e2e4", "a7a8q")
 * @returns {Object} Object with from, to, and promotion properties
 */
export function parseUciMove(moveString) {
  if (!moveString || moveString.length < 4) {
    return null;
  }

  const from = moveString.substring(0, 2);
  const to = moveString.substring(2, 4);

  // Extract promotion piece if exists
  const promotion = moveString.length > 4 ? moveString.substring(4, 5) : undefined;

  return { from, to, promotion };
}

/**
 * Check if a move is valid for a given chess position
 * @param {Chess} chess - Chess.js instance
 * @param {string} from - Source square (e.g., "e2")
 * @param {string} to - Target square (e.g., "e4")
 * @returns {boolean} Whether the move is valid
 */
export function isValidMove(chess, from, to) {
  try {
    // Get all legal moves from the source square
    const moves = chess.moves({ square: from, verbose: true });

    // Check if there's a legal move to the target square
    return moves.some(move => move.to === to);
  } catch (error) {
    console.error('Error checking move validity:', error);
    return false;
  }
}

export default {
  parsePuzzleMoves,
  createReplayPosition,
  parseUciMove,
  isValidMove
};