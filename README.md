# Space Explorer React Game

A space exploration game built with React.js and a simple Express.js backend.

## Features

- Control a spaceship using arrow keys
- Basic score tracking (resets on refresh)
- Starry background animation

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn

## Setup

1. Clone the repository
2. Install backend dependencies:
   ```bash
   npm install
   ```
3. Install frontend dependencies:
   ```bash
   cd client
   npm install
   ```

## Running the Game

1. Start the backend server:
   ```bash
   npm run dev
   ```
2. In a new terminal, start the frontend:
   ```bash
   cd client
   npm start
   ```
3. Open your browser and navigate to `http://localhost:3000`

## How to Play

- Use arrow keys to control the spaceship:
  - Up Arrow: Move forward
  - Down Arrow: Move backward
  - Left/Right Arrows: Rotate the spaceship
- Enter your name before starting the game
- Score is displayed but not saved persistently.

## Technologies Used

- Frontend: React.js, Canvas API
- Backend: Node.js, Express.js
- Styling: CSS 