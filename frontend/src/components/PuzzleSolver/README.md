# PuzzleSolver Component Structure

This directory contains the components for the chess puzzle solver feature of the application. The component has been divided into smaller, more manageable parts to improve code organization and maintainability.

## Component Structure

- **index.jsx** - Main container component that orchestrates all other components
- **PuzzleBoard.jsx** - Handles rendering the chessboard and piece movement
- **PuzzleControls.jsx** - Provides buttons for showing solution and navigating puzzles
- **PuzzleHeader.jsx** - Displays puzzle information, motives, and timer
- **PuzzleProgress.jsx** - Shows progress bar and completion status
- **PuzzleStatus.jsx** - Displays error messages and success/failure notifications
- **PuzzleLogic.js** - Contains utility functions for chess game logic
- **PuzzleSolver.module.css** - Shared styles for all components

## Component Integration

The main component (`index.jsx`) imports all the smaller components and passes the necessary props to each one. The logic has been separated from the UI, with the business logic contained in `PuzzleLogic.js`.

## Key Features

- Puzzle solving workflow with immediate feedback
- Timer with visual indication of remaining time
- Solution replay functionality
- Progress tracking through multiple puzzles
- Error handling for illegal moves
- Responsive design for different screen sizes

## Usage

The PuzzleSolver component expects an array of puzzle exercises and an optional onComplete callback:

```jsx
<PuzzleSolver
  exercises={puzzleData}
  onComplete={handleSessionCompletion}
/>
```

Each puzzle in the exercises array should have:
- `initial_fen` - The starting position in FEN notation
- `moves` - Array of moves in UCI format (e.g., "e2e4")
- `motives` (optional) - Description of the puzzle theme or goal