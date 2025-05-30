import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import styles from './PuzzleSolver.module.css';

const PuzzleBoard = ({ game, orientation, onMove }) => {
  const [boardWidth, setBoardWidth] = useState(600);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredSquare, setHoveredSquare] = useState(null);
  const [selectedPiece, setSelectedPiece] = useState(null);
  const boardContainerRef = useRef(null);

  // Function to update board size based on window width
  const updateBoardSize = useCallback(() => {
    if (boardContainerRef.current) {
      const containerWidth = boardContainerRef.current.clientWidth || 600;
      // Subtract padding to ensure the board fits within the container
      const newWidth = Math.min(600, containerWidth - 32);
      setBoardWidth(newWidth);
    }
  }, []);

  // Handle piece drag start
  const onPieceDragBegin = useCallback((piece, sourceSquare) => {
    setIsDragging(true);
    setSelectedPiece({ piece, sourceSquare });

    // Return true to allow the drag to begin
    return true;
  }, []);

  // Handle drag over a square
  const onSquareHover = useCallback((square) => {
    setHoveredSquare(square);
  }, []);

  // Handle piece drag end
  const onPieceDragEnd = useCallback(() => {
    setIsDragging(false);
    setSelectedPiece(null);
    setHoveredSquare(null);
  }, []);

  // Alternative click-based move handler for mobile support
  const onSquareClick = useCallback((square) => {
    if (!selectedPiece) {
      // First click - select the piece
      const pieceOnSquare = game.get(square);
      if (pieceOnSquare) {
        setSelectedPiece({ piece: pieceOnSquare.type, sourceSquare: square });
      }
    } else {
      // Second click - attempt to move
      const result = onMove(selectedPiece.sourceSquare, square);

      // Reset selection regardless of move success
      setSelectedPiece(null);

      return result;
    }
    return false;
  }, [game, onMove, selectedPiece]);

  // Custom drop handler with validation
  const handlePieceDrop = useCallback((sourceSquare, targetSquare, piece) => {
    // Reset drag state
    setIsDragging(false);
    setHoveredSquare(null);

    // Pass to the parent component's onMove handler
    return onMove(sourceSquare, targetSquare);
  }, [onMove]);

  useEffect(() => {
    // Initial size calculation
    updateBoardSize();

    // Add resize listener
    window.addEventListener('resize', updateBoardSize);

    // Add touch event listeners to prevent scrolling during drag
    const preventScroll = (e) => {
      if (isDragging) {
        e.preventDefault();
      }
    };

    // Disable context menu on the board to improve the mobile experience
    const preventContextMenu = (e) => {
      e.preventDefault();
      return false;
    };

    document.addEventListener('touchmove', preventScroll, { passive: false });

    // Get board elements to add specific event listeners
    const boardElement = boardContainerRef.current;
    if (boardElement) {
      boardElement.addEventListener('contextmenu', preventContextMenu);

      // Capture touchstart to prevent board scrolling
      boardElement.addEventListener('touchstart', (e) => {
        // Only prevent default if we're on a square
        const target = e.target;
        if (target && (
          target.classList.contains('piece-417db') ||
          target.closest('.square-55d63')
        )) {
          e.preventDefault();
        }
      }, { passive: false });
    }

    // Clean up
    return () => {
      window.removeEventListener('resize', updateBoardSize);
      document.removeEventListener('touchmove', preventScroll);

      if (boardElement) {
        boardElement.removeEventListener('contextmenu', preventContextMenu);
      }
    };
  }, [updateBoardSize, isDragging]);

  // Recalculate size when orientation changes
  useEffect(() => {
    updateBoardSize();
  }, [orientation, updateBoardSize]);

  // Generate square styles for highlighted squares
  const getCustomSquareStyles = useCallback(() => {
    // Base styles for highlighting the last move
    const lastMoveStyles = game.history({ verbose: true }).length > 0
      ? {
          [game.history({ verbose: true })[game.history().length - 1].from]: {
            backgroundColor: 'rgba(255, 255, 0, 0.4)',
          },
          [game.history({ verbose: true })[game.history().length - 1].to]: {
            backgroundColor: 'rgba(255, 255, 0, 0.4)',
          },
        }
      : {};

    // Add highlight for currently selected piece
    const selectedStyles = selectedPiece
      ? {
          [selectedPiece.sourceSquare]: {
            backgroundColor: 'rgba(102, 126, 234, 0.4)',
          },
        }
      : {};

    // Add highlight for hovered square during drag
    const hoverStyles = hoveredSquare && isDragging
      ? {
          [hoveredSquare]: {
            boxShadow: 'inset 0 0 20px 5px rgba(102, 126, 234, 0.6)',
          },
        }
      : {};

    return {
      ...lastMoveStyles,
      ...selectedStyles,
      ...hoverStyles,
    };
  }, [game, hoveredSquare, isDragging, selectedPiece]);

  // Create a fallback touch handler
  const onTouchStart = (e) => {
    // This prevents scrolling while trying to drag pieces on mobile
    if (e.target.classList.contains('piece-417db') ||
        e.target.closest('.square-55d63')) {
      e.preventDefault();
    }
  };

  return (
    <div
      className={styles.board}
      ref={boardContainerRef}
      onTouchStart={onTouchStart}
    >
      <Chessboard
        id="puzzleSolverBoard"
        position={game.fen()}
        onPieceDrop={handlePieceDrop}
        onPieceDragBegin={onPieceDragBegin}
        onPieceDragEnd={onPieceDragEnd}
        onSquareClick={onSquareClick}
        onSquareHover={onSquareHover}
        boardOrientation={orientation}
        customDarkSquareStyle={{ backgroundColor: '#779952' }}
        customLightSquareStyle={{ backgroundColor: '#edeed1' }}
        customDropSquareStyle={{
          boxShadow: 'inset 0 0 20px 5px rgba(102, 126, 234, 0.6)'
        }}
        customSquareStyles={getCustomSquareStyles()}
        areArrowsAllowed={false}
        arePiecesDraggable={true}
        animationDuration={100}
        snapToCursor={true}
        snapToCursorAfter={true}
        dragOpacity={0.9}
        pieceSize={80}
        showBoardNotation={true}
        width={boardWidth}
        boardStyle={{
          userSelect: 'none',
          borderRadius: '4px',
          boxShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
          position: 'relative',
          touchAction: 'none',
        }}
      />
    </div>
  );
};

export default PuzzleBoard;