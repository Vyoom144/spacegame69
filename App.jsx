import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [gameState, setGameState] = useState('start') // start, playing, gameOver
  const [playerName, setPlayerName] = useState('')
  const [score, setScore] = useState(0)
  const [highScores, setHighScores] = useState([])
  const fixedY = 90;
  // Define the bounds for the spaceship (25% to 75% of screen width)
  const minX = 25;
  const maxX = 75;
  const [spaceshipPosition, setSpaceshipPosition] = useState({ x: 50, y: fixedY })
  const spaceshipPositionRef = useRef({ x: 50, y: fixedY });
  const [lasers, setLasers] = useState([]); // [{x, y}]
  const gameAreaRef = useRef(null)
  const gameLoopRef = useRef(null)
  const [enemies, setEnemies] = useState([]); // [{id, x, y}]
  // Sun's center position (x: 50%, y: sunY)
  const sunY = 10; // sun is at top: 10%
  const [spawnInterval, setSpawnInterval] = useState(2000); // ms
  const [timeElapsed, setTimeElapsed] = useState(0);
  const [playerId, setPlayerId] = useState(null);
  const [enemiesDestroyed, setEnemiesDestroyed] = useState(0);

  // Save game session and update player when game is over
  const handleGameOver = () => {
    setGameState('gameOver');
    
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
    }
    
    if (playerId) {
      // Save game session
      fetch('http://localhost:5000/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: playerId,
          duration: timeElapsed,
          enemies_destroyed: enemiesDestroyed
        }),
      })
      .catch(error => console.error('Error saving game session:', error));
      
      // Update player score
      fetch('http://localhost:5000/api/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playerName,
          score: score,
          level: 1
        }),
      })
      .then(response => response.json())
      .then(() => {
        // Immediately fetch updated high scores
        return fetch('http://localhost:5000/api/players');
      })
      .then(response => response.json())
      .then(data => {
        setHighScores(data);
      })
      .catch(error => console.error('Error updating player score or fetching high scores:', error));
    }
  }

  const startGame = () => {
    if (playerName.trim()) {
      // Save player to database first
      fetch('http://localhost:5000/api/players', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: playerName,
          score: 0,
          level: 1
        }),
      })
      .then(res => res.json())
      .then(data => {
        setPlayerId(data.id);
        setGameState('playing');
        setScore(0);
        setEnemiesDestroyed(0);
        setTimeElapsed(0);
        setSpaceshipPosition({ x: 50, y: fixedY });
        startGameLoop();
      })
      .catch(error => {
        console.error('Error saving player:', error);
        // Start the game anyway to avoid blocking the player if the server is down
        setGameState('playing');
        setScore(0);
        setEnemiesDestroyed(0);
        setTimeElapsed(0);
        setSpaceshipPosition({ x: 50, y: fixedY });
        startGameLoop();
      });
    }
  }

  // Keep ref in sync with state
  useEffect(() => {
    spaceshipPositionRef.current = spaceshipPosition;
  }, [spaceshipPosition]);

  const handleKeyDown = (e) => {
    if (gameState !== 'playing') return
    const speed = 2

    switch (e.key) {
      case 'ArrowLeft':
        setSpaceshipPosition(prev => ({ ...prev, x: Math.max(minX, prev.x - speed), y: fixedY }))
        break
      case 'ArrowRight':
        setSpaceshipPosition(prev => ({ ...prev, x: Math.min(maxX, prev.x + speed), y: fixedY }))
        break
      case ' ':
      case 'Spacebar':
        e.preventDefault(); // Prevent browser from scrolling or blocking
        // Shoot laser from the latest spaceship position
        const { x } = spaceshipPositionRef.current;
        setLasers(prev => [
          ...prev,
          { x, y: fixedY }
        ])
        break
    }
  }

  const gameLogicUpdate = () => {
    if (gameState !== 'playing') return
  }

  const startGameLoop = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
    }
    gameLoopRef.current = setInterval(gameLogicUpdate, 1000 / 60)
  }

  // Move lasers upward
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      setLasers(prev => prev
        .map(l => ({ ...l, y: l.y - 2 }))
        .filter(l => l.y > 0)
      );
    }, 1000 / 60);
    return () => clearInterval(interval);
  }, [gameState]);

  useEffect(() => {
    if (gameState === 'playing') {
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
        if (gameLoopRef.current) {
          clearInterval(gameLoopRef.current)
        }
      }
    }
  }, [gameState])

  // Fetch high scores immediately on component mount and after game state changes
  useEffect(() => {
    const fetchHighScores = () => {
      fetch('http://localhost:5000/api/players')
        .then(res => res.json())
        .then(data => {
          setHighScores(data);
          console.log("High scores fetched:", data);
        })
        .catch(error => {
          console.error('Error fetching high scores:', error);
          // If server is down, provide some sample scores
          if (highScores.length === 0) {
            setHighScores([
              { id: 1, name: "Player 1", score: 500, date_created: new Date().toISOString() },
              { id: 2, name: "Player 2", score: 400, date_created: new Date().toISOString() },
              { id: 3, name: "Player 3", score: 300, date_created: new Date().toISOString() }
            ]);
          }
        });
    };

    fetchHighScores();
    
    // Set up an interval to periodically refresh high scores
    const intervalId = setInterval(fetchHighScores, 30000); // Refresh every 30 seconds
    
    return () => clearInterval(intervalId);
  }, [gameState]);

  // Helper for random trajectory direction
  const getRandomTrajectory = () => {
    // Generate a value between minX and maxX to determine where the enemy will aim
    // This creates a straight line trajectory from the blackhole center
    const targetX = Math.random() * (maxX - minX) + minX;
    
    // Calculate trajectory based on the difference between target and start position
    // How much to move in x direction per frame
    return (targetX - 50) / 90; // 90 is approximate frames it takes to reach spaceship
  }

  // Helper for random type
  const getRandomType = () => 1 + Math.floor(Math.random() * 3); // 1, 2, or 3

  // Time keeper
  useEffect(() => {
    if (gameState !== 'playing') return;
    setTimeElapsed(0);
    const timer = setInterval(() => {
      setTimeElapsed(t => t + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [gameState]);

  // Gradually increase spawn speed
  useEffect(() => {
    if (gameState !== 'playing') return;
    setSpawnInterval(2000);
    const speedUp = setInterval(() => {
      setSpawnInterval(prev => Math.max(600, prev - 100));
    }, 4000);
    return () => clearInterval(speedUp);
  }, [gameState]);

  // Spawn enemies on interval
  useEffect(() => {
    if (gameState !== 'playing') return;
    const spawn = () => {
      setEnemies(prev => {
        if (prev.length >= 3) return prev;
        const toSpawn = 2 + Math.floor(Math.random() * 2) - prev.length;
        if (toSpawn <= 0) return prev;
        const newEnemies = Array.from({ length: toSpawn }, (_, i) => ({
          id: Date.now() + Math.random() + i,
          x: 50, // Always spawn from blackhole center (sun center)
          y: sunY,
          trajectory: getRandomTrajectory(), // Replace drift with trajectory for straight line
          type: getRandomType()
        }));
        return [...prev, ...newEnemies];
      });
    };
    spawn();
    const interval = setInterval(spawn, spawnInterval);
    return () => clearInterval(interval);
  }, [gameState, spawnInterval, enemies.length]);

  // Move enemies down in straight trajectories
  useEffect(() => {
    if (gameState !== 'playing') return;
    const interval = setInterval(() => {
      setEnemies(prev => prev
        .map(e => {
          // Calculate new position with constant trajectory for straight line movement
          let newX = e.x + e.trajectory;
          
          // Keep enemies within the playable area boundaries
          newX = Math.max(minX, Math.min(maxX, newX));
          
          return { 
            ...e, 
            y: e.y + 0.7, // Consistent vertical speed
            x: newX 
          };
        })
        .filter(e => e.y < 100)
      );
    }, 1000 / 60);
    return () => clearInterval(interval);
  }, [gameState]);

  // Collision detection: laser vs enemy
  useEffect(() => {
    if (gameState !== 'playing') return;
    let hitCount = 0;
    setEnemies(prevEnemies => prevEnemies.filter(enemy => {
      const hit = lasers.some(laser =>
        Math.abs(laser.x - enemy.x) < 4 && Math.abs(laser.y - enemy.y) < 6
      );
      if (hit) {
        hitCount++;
        setEnemiesDestroyed(prev => prev + 1);
        // Update score directly based on enemies destroyed
        setScore(prev => prev + 10);
        setLasers(lasers => lasers.filter(laser =>
          !(Math.abs(laser.x - enemy.x) < 4 && Math.abs(laser.y - enemy.y) < 6)
        ));
      }
      return !hit;
    }));
  }, [lasers, gameState]);

  // End game if enemy hits spaceship
  useEffect(() => {
    if (gameState !== 'playing') return;
    const collision = enemies.some(enemy =>
      Math.abs(enemy.x - spaceshipPosition.x) < 8 && Math.abs(enemy.y - spaceshipPosition.y) < 8
    );
    if (collision) {
      handleGameOver();
    }
  }, [enemies, spaceshipPosition, gameState]);

  // Update enemy elements to use the image obstacles
  const renderEnemy = (enemy) => {
    // Determine which alien ship image to use based on enemy type
    const alienShipImage = enemy.type === 1 ? 'm1.png' : enemy.type === 2 ? 'm2.png' : 'm3.png';
    
    return (
      <div
        key={enemy.id}
        className="enemy"
        style={{
          left: `${enemy.x}%`,
          top: `${enemy.y}%`,
          width: '40px',
          height: '40px',
        }}
      >
        <img 
          src={`/${alienShipImage}`} 
          alt="Alien Ship" 
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            transform: enemy.type === 3 ? 'rotate(45deg)' : 'none',
          }}
        />
      </div>
    );
  };

  // Handle Enter key press on start screen
  const handleStartScreenKeyDown = (e) => {
    if (e.key === 'Enter' && playerName.trim()) {
      startGame();
    }
  }

  // Handle Enter key press on game over screen
  const handleGameOverKeyDown = (e) => {
    if (e.key === 'Enter') {
      resetGame();
    }
  }

  // Function to reset the game (extracted from the Play Again button click handler)
  const resetGame = () => {
    setGameState('start')
    setLasers([])
    setEnemies([])
    setScore(0)
    setTimeElapsed(0)
    setEnemiesDestroyed(0)
    setPlayerId(null)
    setSpaceshipPosition({ x: 50, y: fixedY })
    
    // Refresh high scores
    fetch('http://localhost:5000/api/players')
      .then(res => res.json())
      .then(data => setHighScores(data))
      .catch(error => console.error('Error fetching high scores:', error));
  }

  // Add event listener for Enter key on start screen
  useEffect(() => {
    if (gameState === 'start') {
      window.addEventListener('keydown', handleStartScreenKeyDown);
      return () => {
        window.removeEventListener('keydown', handleStartScreenKeyDown);
      };
    }
  }, [gameState, playerName]);

  // Add event listener for Enter key on game over screen
  useEffect(() => {
    if (gameState === 'gameOver') {
      window.addEventListener('keydown', handleGameOverKeyDown);
      return () => {
        window.removeEventListener('keydown', handleGameOverKeyDown);
      };
    }
  }, [gameState]);

  return (
    <div className="App">
      {gameState === 'start' && (
        <div className="start-screen">
          <h1>Space Explorer</h1>
          
          {/* Show high scores more prominently */}
          <div className="high-scores-featured">
            <h2>High Scores</h2>
            <div className="scores-container">
              {highScores.length > 0 ? (
                highScores.slice(0, 5).map((player, index) => (
                  <div key={index} className="high-score-entry">
                    <span className="rank">{index + 1}.</span>
                    <span className="name">{player.name}</span>
                    <span className="score">{player.score}</span>
                    <span className="date">{new Date(player.date_created).toLocaleDateString()}</span>
                  </div>
                ))
              ) : (
                <div className="no-scores">No scores yet. Be the first!</div>
              )}
            </div>
          </div>
          
          <div className="player-input">
            <input
              type="text"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
            <button onClick={startGame}>Start Game</button>
          </div>
        </div>
      )}

      {gameState === 'playing' && (
        <div className="game-screen">
          <div className="game-info">
            <h2>Player: {playerName}</h2>
            <h3>Score: {score}</h3>
            <h3>Time: <TimeKeeper time={timeElapsed} /></h3>
            <h3>Alien Ships Destroyed: {enemiesDestroyed}</h3>
          </div>
          <div className="game-area" ref={gameAreaRef}>
            {/* Replace the static black hole image with a video */}
            <video 
              src="/blackhole.mp4" 
              className="sun" 
              autoPlay 
              loop 
              muted 
              playsInline
            />
            
            {/* Add boundary lines for the spaceship movement area */}
            <div className="spaceship-boundaries boundary-left"></div>
            <div className="spaceship-boundaries boundary-right"></div>
            <div className="movement-floor"></div>
            
            {lasers.map((laser, idx) => (
              <div
                key={idx}
                className="laser"
                style={{
                  left: `${laser.x}%`,
                  top: `${laser.y}%`
                }}
              ></div>
            ))}
            {enemies.map(enemy => renderEnemy(enemy))}
            <div className="spaceship" style={{
              left: `${spaceshipPosition.x}%`,
              top: `${spaceshipPosition.y}%`
            }}></div>
          </div>
        </div>
      )}

      {gameState === 'gameOver' && (
        <div className="game-over">
          <h1>Game Over!</h1>
          <h2>Final Score: {score}</h2>
          <h3>Alien Ships Destroyed: {enemiesDestroyed}</h3>
          <button onClick={resetGame}>Play Again</button>
        </div>
      )}
    </div>
  )
}

function TimeKeeper({ time }) {
  const mins = Math.floor(time / 60);
  const secs = time % 60;
  return <span>{mins}:{secs.toString().padStart(2, '0')}</span>;
}

export default App
